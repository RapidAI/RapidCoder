<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit" hideAdd>
    <a-tab-pane
        v-for="(file, index) in currentSession.currentSelectFile"
        :key="file"
        :tab="getTitle(file)"
        :closable="true"
    >
      <CodeMirrorEditor :content="fileContents[index]" :language="file.split('.').pop()"/>
    </a-tab-pane>
  </a-tabs>
</template>
<script>
import {useSessionStore} from "@/store/SessionStore";
import {ref, computed, watch} from "vue";

const {ipcRenderer} = require("electron");
import CodeMirrorEditor from "@/components/common/CodeMirrorEditor.vue";

export default {
  components: {
    CodeMirrorEditor,
  },
  props: {
    selectedSessionId: {required: true},
  },
  setup(props) {
    const fileContents = ref([]);
    const activeFile = ref(null);
    const sessionStore = useSessionStore();

    const currentSession = computed(
        () =>
            sessionStore.sessions.find(
                (s) => s.sessionId === props.selectedSessionId
            ) || {}
    );

    const getTitle = (filePath) => filePath.split("/").pop();

    const wrapFileContent = (content, filePath) => {
      const language = filePath.split('.').pop();
      return `${filePath}\n\`\`\`${language}\n${content}\n\`\`\``;
    };

    watch(
        () => currentSession.value?.currentSelectFile,
        async (newFiles) => {
          if (newFiles?.length) {
            fileContents.value = await Promise.all(
                newFiles.map((file) =>
                    ipcRenderer.invoke("getFileContent", file)
                )
            );
            if (!newFiles.includes(activeFile.value)) {
              activeFile.value = newFiles[0];
            }
            currentSession.value.messages = [
              {
                role: "system",
                content: fileContents.value.join("\n"),
              },
            ];
          } else {
            currentSession.value.messages = [
              {
                role: "system",
                content: "",
              },
            ];
          }
        },
        {immediate: true}
    );

    const onEdit = (targetKey, action) => {
      if (action === "remove") {
        const index = currentSession.value.currentSelectFile.indexOf(targetKey);
        if (index !== -1) {
          currentSession.value.currentSelectFile = [
            ...currentSession.value.currentSelectFile.slice(0, index),
            ...currentSession.value.currentSelectFile.slice(index + 1),
          ];
        }
      }
    };

    return {
      currentSession,
      fileContents,
      getTitle,
      onEdit,
      activeFile,
    };
  },
};
</script>
