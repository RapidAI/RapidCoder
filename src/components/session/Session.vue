<template>
  <a-layout class="full-height">
    <!-- 侧边栏 -->
    <a-layout-sider theme="light" width="300">
      <!-- 新建对话 -->
      <div class="fixed-button-container">
        <a-button class="new_session_button" type="primary" :loading="loadingProjects" @click="createNewSession">
          <template #icon>
            <EditOutlined/>
          </template>
          新对话
        </a-button>
      </div>
      <!-- 对话列表 -->
      <div class="scrollable-menu-container">
        <a-menu v-if="messageStore.sessions.length" mode="inline" inlineIndent="0"
                :selectedKeys="[messageStore.currentSession?.sessionId]"
                class="custom-menu">
          <a-menu-item v-for="(session, index) in messageStore.sessions.slice().reverse()" :key="session.sessionId">
            <div class="menu-item-container">
              <a-button type="link" @click="deleteSession(session)">
                <template #icon>
                  <DeleteOutlined />
                </template>
              </a-button>
              <span class="menu-item-title" @click="selectSession(session)">
                {{ getSessionTitle(session) }}
              </span>
            </div>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>

    <!-- 对话内容区域 -->
    <a-layout-content class="custom-content">
      <Chat v-if="messageStore.currentSession.sessionId"/>
    </a-layout-content>

    <!-- 新建对话选择模型和项目模态框 -->
    <a-modal v-model:open="isSessionCreationModalVisible" title="选择模型和项目" okText="确定" cancelText="取消"
             @ok="handleCreateSession" @cancel="handleCancelCreateSession">
      <a-select
          v-model:value="selectedModelId"
          placeholder="请选择模型"
          style="width: 100%; margin-bottom: 20px"
          :options="modelStore.models.map(model => ({ label: model.modelName, value: model.modelId }))"
      />
      <a-select
          v-model:value="selectedProjectId"
          mode="multiple"
          placeholder="请选择项目"
          style="width: 100%"
          :options="projectStore.projects.map(project => ({ label: project.projectDescription, value: project.projectId }))"
      />
    </a-modal>
  </a-layout>
</template>
<script>
import {ref, onMounted} from 'vue';
import Chat from '../chatwithbigdata/Chat.vue';
import {useMessageStore} from '@/store/MessageStore.js';
import {DatabaseOutlined, EditOutlined, DeleteOutlined} from '@ant-design/icons-vue';
import {message} from 'ant-design-vue';
import {useRoute, useRouter} from 'vue-router';
import {eventBus} from "@/eventBus";
import {useProjectStore} from "@/store/ProjectStore";
import {useModelStore} from "@/store/ModelStore";

export default {
  components: {
    DatabaseOutlined,
    Chat,
    EditOutlined,
    DeleteOutlined,
  },
  setup() {
    const messageStore = useMessageStore();
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
    const loadingProjects = ref(false);
    const isSessionCreationModalVisible = ref(false);
    const selectedModelId = ref(null);
    const selectedProjectId = ref([]);

    const route = useRoute();
    const router = useRouter();

    const locateSessionFromUrl = async () => {
      const sessionId = route.query.sessionId;
      if (sessionId) {
        const session = messageStore.sessions.find(s => String(s.sessionId) === sessionId);
        if (session) {
          selectSession(session);
        }
      } else if (messageStore.sessions.length) {
        selectSession(messageStore.sessions[messageStore.sessions.length - 1]);
      }
    };

    const createNewSession = () => {
      isSessionCreationModalVisible.value = true;
    };

    const handleCancelCreateSession = () => {
      isSessionCreationModalVisible.value = false;
      selectedModelId.value = null;
      selectedProjectId.value = [];
    };

    const handleCreateSession = async () => {
      try {
        loadingProjects.value = true;
        const selectedModel = modelStore.models.find(model => model.modelId === selectedModelId.value);
        const selectedProjects = projectStore.projects.filter(project => selectedProjectId.value.includes(project.projectId));

        if (!selectedModel) {
          message.error('模型不存在');
          return;
        }

        await messageStore.createSession(selectedModel, selectedProjects);
        router.push({query: {sessionId: messageStore.currentSession.sessionId}});
      } catch (error) {
        message.error('创建会话失败，请稍后再试');
      } finally {
        loadingProjects.value = false;
        isSessionCreationModalVisible.value = false;
      }
    };

    const getSessionTitle = (session) => {
      return session.messages[1]?.content || '新对话';
    };

    const selectSession = (session) => {
      messageStore.currentSession = session;
      router.push({query: {sessionId: session.sessionId}});
      eventBus.emit('messageUpdated', session.messages.length - 1);
    };

    const deleteSession = async (session) => {
      this.messageStore.sessions = this.messageStore.sessions.filter();
    };

    onMounted(() => {
      loadingProjects.value = true;
      locateSessionFromUrl().finally(() => {
        loadingProjects.value = false;
      });
    });

    return {
      messageStore,
      selectSession,
      deleteSession,
      getSessionTitle,
      projectStore,
      modelStore,
      createNewSession,
      handleCreateSession,
      handleCancelCreateSession,
      selectedModelId,
      selectedProjectId,
      isSessionCreationModalVisible,
      loadingProjects,
    };
  },
};
</script>

<style scoped lang="scss">
.fixed-button-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: white;
  padding: 10px 0;
}

.scrollable-menu-container {
  max-height: calc(100vh - 60px); /* 60px 是按钮容器的高度 */
  overflow-y: auto;
}

.new_session_button {
  width: 100%;
}

.menu-item-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-content {
  padding: 20px;
}
</style>
