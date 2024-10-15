<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit">
    <a-tab-pane v-for="(file, index) in currentSession.currentSelectFile" :key="file" :tab="sessionTitle(file)" :closable="true">
      {{ file }}1
    </a-tab-pane>
  </a-tabs>
  {{activeFile}}
</template>

<script>
import {useSessionStore} from "@/store/SessionStore";
import {ref, computed, watch} from "vue";

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  setup(props) {
    const fileContent = ref([]); // 用于存储每个文件的内容
    const activeFile = ref(null); // 当前激活的文件
    const sessionStore = useSessionStore();

    const currentSession = computed(() => sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null);

    // 截取文件路径的最后部分作为标题
    const sessionTitle = (filePath) => filePath.split('/').pop();

    // 监听 currentSession.currentSelectFile 的变化
    watch(
        () => currentSession.value?.currentSelectFile,
        async (newSelectFiles) => {
          if (newSelectFiles?.length) {
            fileContent.value = await Promise.all(newSelectFiles.map(file => ipcRenderer.invoke('getFileContent', file)));
            console.log(fileContent.value)
            activeFile.value = activeFile.value || newSelectFiles[0]; // 保持第一个文件为默认激活
          }
        },
        {immediate: true}
    );

    // 处理标签编辑（删除）操作
    const onEdit = (targetKey, action) => {
      if (action === 'remove') {
        const indexToRemove = currentSession.value.currentSelectFile.indexOf(targetKey);
        if (indexToRemove !== -1) {
          currentSession.value.currentSelectFile.splice(indexToRemove, 1);
          fileContent.value.splice(indexToRemove, 1);
          activeFile.value = currentSession.value.currentSelectFile[0] || null;
        }
      }
    };

    return {
      currentSession,
      fileContent,
      sessionTitle,
      onEdit,
      activeFile,
    };
  }
};
</script>