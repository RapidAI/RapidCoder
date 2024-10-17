<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit" hideAdd>
    <a-tab-pane
        v-for="(file, index) in currentSession.currentSelectFile"
        :key="file"
        :closable="true"
    >
      <template #tab>
        <span style="color: #1e1e1e">
          {{ getTitle(file) }}
        </span>
      </template>
      <code-editor :content="fileContents[index]" :selectedSessionId="selectedSessionId"
                   :language="file.split('.').pop()" :file-path="file"/>
    </a-tab-pane>
  </a-tabs>
</template>
<script>
import {useSessionStore} from "@/store/SessionStore";
import {ref, computed, watch} from "vue";

const {ipcRenderer} = require("electron");
import CodeEditor from "@/components/chatcomponents/CodeEditor.vue";
import CustomLoading from "@/components/common/CustomLoading.vue";

export default {
  components: {
    CustomLoading,
    CodeEditor,
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
      return `\`\`\`${language}:${filePath}\n${content}\n\`\`\``;
    };

    watch(
        () => currentSession.value?.currentSelectFile,
        async (newFiles, oldFiles = []) => {
          if (newFiles?.length) {
            // 获取新的文件内容
            fileContents.value = await Promise.all(
                newFiles.map((file) => ipcRenderer.invoke("getFileContent", file))
            );

            // 设置 activeFile，如果不在新文件列表中，默认第一个
            activeFile.value = newFiles.includes(activeFile.value) ? activeFile.value : newFiles[0];

            // 更新系统消息内容
            currentSession.value.messages[0] = {
              role: "system",
              content: fileContents.value.map((content, index) => wrapFileContent(content, newFiles[index])).join("\n"),
            };

            // 对新增的文件进行监控并处理文件变化和删除事件
            newFiles.forEach((file) => {
              if (!oldFiles.includes(file)) {
                ipcRenderer.invoke('initFileWatch', file, props.selectedSessionId);
                setupFileWatch(file, newFiles);
              }
            });

            // 移除不再选中的文件的监控
            oldFiles.forEach((file) => {
              if (!newFiles.includes(file)) {
                ipcRenderer.invoke('removeFileWatch', file, props.selectedSessionId);
              }
            });
          }
        },
        {immediate: true}
    );

// 处理文件变化和删除的函数
    const setupFileWatch = (file, newFiles) => {
      ipcRenderer.on(file, async (event, {action, fileInfo}) => {
        const index = newFiles.indexOf(fileInfo.key);
        if (action === 'change' && index !== -1) {
          // 重新获取文件内容并更新
          const updatedContent = await ipcRenderer.invoke('getFileContent', fileInfo.key);
          fileContents.value[index] = updatedContent;
          //
          // // 更新系统消息
          // currentSession.value.messages[0].content = fileContents.value
          //     .map((content, idx) => wrapFileContent(content, newFiles[idx]))
          //     .join("\n");
        } else if (action === 'unlink' && index !== -1) {
          // 移除删除的文件
          currentSession.value.currentSelectFile.splice(index, 1);
          fileContents.value.splice(index, 1);
        }
      });
    };


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
