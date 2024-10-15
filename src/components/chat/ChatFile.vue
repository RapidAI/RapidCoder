<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit">
    <a-tab-pane v-for="(session, index) in currentSession.currentSelectFile" :key="session" :tab="sessionTitle(session)"
                :closable="true">
      {{ fileContent[index] }}
    </a-tab-pane>
  </a-tabs>
</template>

<script>
import CustomLoading from '@/components/common/CustomLoading.vue';
import {useSessionStore} from "@/store/SessionStore";
import {ref, computed, watch} from "vue";

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  components: {CustomLoading},
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