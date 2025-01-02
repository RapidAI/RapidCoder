<template>
  <!-- 对话tab区域 -->
  <a-tabs
      v-model:activeKey="sessionStore.selectedSessionId"
      size="small"
      class="my-custom-tabs"
  >
    <!-- 通过 :tab="renderTabTitle(session)" 自定义标题 + 关闭按钮 -->
    <a-tab-pane
        v-for="session in sessionStore.sessions"
        :key="session.sessionId"
        :tab="renderTabTitle(session)"
    >
      <Chat :selectedSessionId="session.sessionId" />
    </a-tab-pane>

    <!-- 新对话按钮，保留原逻辑 -->
    <template #leftExtra>
      <a-button type="text" @click="newsession">新对话</a-button>
    </template>
  </a-tabs>

  <!-- 新建对话选择模型和项目模态框（保持原逻辑） -->
  <a-modal
      :mask="false"
      v-model:open="isSessionCreationModalVisible"
      title="选择模型和项目"
      okText="确定"
      cancelText="取消"
      @ok="createSession"
      @cancel="resetModal"
  >
    <div>
      <p><strong>请选择一个模型：</strong><span style="color: red;">*</span></p>
      <a-radio-group v-model:value="selectedModelId" style="width: 100%">
        <a-radio
            v-for="model in modelOptions"
            :key="model.value"
            :value="model.value"
        >
          {{ model.label }}
        </a-radio>
      </a-radio-group>
      <p v-if="!selectedModelId" style="color: #f5222d; margin-top: 5px;">
        请选择一个模型以继续。
      </p>
    </div>

    <div style="margin-top: 20px;">
      <p><strong>请选择项目路径：</strong></p>
      <a-button @click="selectDirectory">选择目录</a-button>
      <p v-if="projectPath">选定的路径: {{ projectPath }}</p>
    </div>
  </a-modal>
</template>

<script>
import { ref, h } from 'vue';
const { ipcRenderer } = require('electron');
import Chat from '../chat/Chat.vue';
import CustomLoading from '../common/CustomLoading.vue';
import { useSessionStore } from '@/store/SessionStore.js';
import { useModelStore } from '@/store/ModelStore';
import { message } from 'ant-design-vue';
// 引入关闭图标
import { CloseOutlined } from '@ant-design/icons-vue';

export default {
  components: {
    Chat,
    CustomLoading,
    CloseOutlined, // 注册关闭图标
  },
  setup() {
    const sessionStore = useSessionStore();
    const modelStore = useModelStore();

    const isSessionCreationModalVisible = ref(false);
    const selectedModelId = ref(null);
    const projectPath = ref(null);

    const modelOptions = modelStore.models.map(({ model, modelId }) => ({
      label: model,
      value: modelId,
    }));

    // 生成 Tab 上显示的标题内容（包含自定义Loading图标 + 文本 + 关闭按钮）
    const renderTabTitle = (session) => {
      // 这里返回一个渲染函数 (VNode)
      return () =>
          h(
              'span',
              {
                style: {
                  color: '#1e1e1e',
                  display: 'inline-flex',
                  alignItems: 'center',
                },
              },
              [
                // 若 isStreaming，则放置一个 CustomLoading
                session.isStreaming
                    ? h(CustomLoading, { class: 'loading-icon' })
                    : null,
                ' ' + sessionTitle(session),
                // 关闭图标
                h(CloseOutlined, {
                  style: { marginLeft: '8px', cursor: 'pointer' },
                  // 防止点击关闭图标时切换Tab
                  onClick: (e) => {
                    e.stopPropagation();
                    closeSession(session);
                  },
                }),
              ]
          );
    };

    // 关闭单个 session 的逻辑
    const closeSession = (session) => {
      const sessionIndex = sessionStore.sessions.findIndex(
          (s) => s.sessionId === session.sessionId
      );
      if (sessionIndex !== -1) {
        sessionStore.sessions.splice(sessionIndex, 1);
        if (sessionStore.sessions.length) {
          // 重新选择一个相邻的 session
          sessionStore.selectedSessionId =
              sessionStore.sessions[
                  Math.min(sessionIndex, sessionStore.sessions.length - 1)
                  ].sessionId;
        } else {
          sessionStore.selectedSessionId = null;
        }
      }
    };

    const sessionTitle = (session) => {
      const title = new URL(`file://${session.currentProjectPath}`)
          .pathname.split('/')
          .pop();
      return title.length > 20 ? title.substring(0, 20) + '...' : title;
    };

    // 新建对话相关的逻辑与原先保持不变
    const resetModal = () => {
      isSessionCreationModalVisible.value = false;
      selectedModelId.value = null;
      projectPath.value = null;
    };

    const createSession = async () => {
      if (!selectedModelId.value) {
        return message.error('请选择模型');
      }
      if (!projectPath.value) {
        return message.error('请选择项目路径');
      }
      try {
        const model = modelStore.models.find(
            (m) => m.modelId === selectedModelId.value
        );
        const newSession = sessionStore.createSession(model, projectPath.value);
        sessionStore.selectedSessionId = newSession.sessionId;
      } catch (e) {
        message.error('创建会话失败');
      } finally {
        resetModal();
      }
    };

    const selectDirectory = () => {
      ipcRenderer
          .invoke('getDirectoryDialog')
          .then((result) => {
            if (result && !result.canceled && result.filePaths.length > 0) {
              projectPath.value = result.filePaths[0];
              // 选择完目录后立即调用 createSession
              createSession();
            }
          })
          .catch((err) => {
            console.error('Failed to select directory:', err);
          });
    };

    // 打开新建会话 Modal
    const newsession = () => {
      isSessionCreationModalVisible.value = true;
    };

    return {
      sessionStore,
      isSessionCreationModalVisible,
      selectedModelId,
      projectPath,
      modelOptions,
      renderTabTitle,
      closeSession,
      sessionTitle,
      createSession,
      resetModal,
      newsession,
      selectDirectory,
    };
  },
};
</script>

<style scoped>
.my-custom-tabs {
  /* 如果需要自定义 .ant-tabs-nav 或相关样式，可在此处编写 */
}

/* 保持原先的 Tabs nav margin-bottom: 0  */
:deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
</style>