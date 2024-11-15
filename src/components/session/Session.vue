<template>
  <!-- 对话tab区域 -->
  <a-tabs v-model:activeKey="sessionStore.selectedSessionId" size="small" type="editable-card" @edit="onEdit" hideAdd>
    <a-tab-pane v-for="session in sessionStore.sessions" :key="session.sessionId" :closable="true">
      <template #tab>
        <span style="color: #1e1e1e">
          <custom-loading v-if="session.isStreaming" class="loading-icon"/>
          {{ sessionTitle(session) }}
        </span>
      </template>
      <Chat :selectedSessionId="session.sessionId"/>
    </a-tab-pane>
    <template #leftExtra>
      <a-button type="text" @click="newsession">新对话</a-button>
    </template>
  </a-tabs>

  <!-- 新建对话选择模型和项目模态框 -->
  <a-modal :mask="false" v-model:open="isSessionCreationModalVisible" title="选择模型和项目" okText="确定"
           cancelText="取消"
           @ok="createSession" @cancel="resetModal">
    <div>
      <p><strong>请选择一个模型：</strong><span style="color: red;">*</span></p>
      <a-radio-group v-model:value="selectedModelId" style="width: 100%">
        <a-radio v-for="model in modelOptions" :key="model.value" :value="model.value">
          {{ model.label }}
        </a-radio>
      </a-radio-group>
      <p v-if="!selectedModelId" style="color: #f5222d; margin-top: 5px;">请选择一个模型以继续。</p>
    </div>

    <div style="margin-top: 20px;">
      <p><strong>请选择项目路径：</strong></p>
      <a-button @click="selectDirectory">选择目录</a-button>
      <p v-if="projectPath">选定的路径: {{ projectPath }}</p>
    </div>
  </a-modal>
</template>

<script>
import {ref, onMounted} from 'vue';

const {ipcRenderer} = require('electron');
import Chat from '../chat/Chat.vue';
import CustomLoading from '../common/CustomLoading.vue'; // 引入CustomLoading组件
import {useSessionStore} from '@/store/SessionStore.js';
import {useModelStore} from "@/store/ModelStore";
import {EditOutlined} from '@ant-design/icons-vue';
import {message} from 'ant-design-vue';

export default {
  components: {Chat, EditOutlined, CustomLoading}, // 注册CustomLoading组件
  setup() {
    const sessionStore = useSessionStore();
    const modelStore = useModelStore();
    const isSessionCreationModalVisible = ref(false);
    const selectedModelId = ref(null);
    const projectPath = ref(null);


    const modelOptions = modelStore.models.map(({model, modelId}) => ({label: model, value: modelId}));

    const resetModal = () => {
      isSessionCreationModalVisible.value = false;
      selectedModelId.value = null;
      projectPath.value = null;
    };

    const createSession = async () => {
      if (!selectedModelId.value) return message.error('请选择模型');
      if (!projectPath.value) return message.error('请选择项目路径');
      try {
        const model = modelStore.models.find(m => m.modelId === selectedModelId.value);
        const newSession = sessionStore.createSession(model, projectPath.value); // 传递路径而不是项目ID
        sessionStore.selectedSessionId = newSession.sessionId;
      } catch (e) {
        message.error('创建会话失败');
      } finally {
        resetModal();
      }
    };

    const selectDirectory = () => {
      ipcRenderer.invoke('getDirectoryDialog').then((result) => {
        if (result && !result.canceled && result.filePaths.length > 0) {
          projectPath.value = result.filePaths[0];  // 将路径直接赋值给变量
          createSession();  // 选择完目录后立即调用createSession
        }
      }).catch((err) => {
        console.error('Failed to select directory:', err);
      });
    };

    const sessionTitle = (session) => {
      const title =new URL(`file://${session.currentProjectPath}`).pathname.split('/').pop();
      return title.length > 20 ? title.substring(0, 20) + '...' : title;
    };
    const selectSession = (session) => {
      sessionStore.selectedSessionId = session.sessionId;
    };

    const deleteSession = (session) => {
      sessionStore.sessions = sessionStore.sessions.filter(s => s.sessionId !== session.sessionId);
    };

    const onEdit = (targetKey, action) => {
      if (action === 'remove') {
        const sessionIndex = sessionStore.sessions.findIndex(s => s.sessionId === targetKey);
        if (sessionIndex !== -1) {
          sessionStore.sessions.splice(sessionIndex, 1);

          if (sessionStore.sessions.length) {
            sessionStore.selectedSessionId = sessionStore.sessions[Math.min(sessionIndex, sessionStore.sessions.length - 1)].sessionId;
          } else {
            sessionStore.selectedSessionId = null;
          }
        }
      }
    };

    const newsession = () => {
      isSessionCreationModalVisible.value = true;
    };


    return {
      sessionStore,
      isSessionCreationModalVisible,
      selectedModelId,
      projectPath,
      modelOptions,
      sessionTitle,
      createSession,
      resetModal,
      deleteSession,
      selectSession,
      onEdit,
      newsession,
      selectDirectory
    };
  },
};
</script>

<style scoped>
:deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
</style>