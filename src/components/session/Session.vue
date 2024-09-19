<template>
  <a-layout class="full-height">
    <!-- 侧边栏 -->
    <a-layout-sider theme="light">
      <!-- 新建对话 -->
      <div class="fixed-button-container">
        <a-button class="new_session_button" type="primary" :loading="loadingProjects" @click="createNewSession">
          <template #icon>
            <EditOutlined />
          </template>
          新对话
        </a-button>
      </div>
      <!-- 对话列表 -->
      <div class="scrollable-menu-container">
        <a-menu v-if="messageStore.sessions.length" mode="inline"
                :selectedKeys="[messageStore.currentSession?.sessionId]"
                class="custom-menu">
          <a-menu-item v-for="(session, index) in messageStore.sessions.slice().reverse()" :key="session.sessionId">
            <div class="menu-item-container">
              <span class="menu-item-title" @click="selectSession(session)">
                {{ getSessionTitle(session) }}
              </span>
              <a-dropdown class="menu-item-dropdown">
                <EllipsisOutlined />
                <template #overlay>
                  <a-menu>
                    <a-menu-item @click="showRenameModal(index)">重命名</a-menu-item>
                    <a-menu-item>
                      <a-popconfirm title="确定要删除这个会话吗？" okText="确定" cancelText="取消"
                                    @confirm="deleteSession(index)">
                        <span>删除</span>
                      </a-popconfirm>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>

    <!-- 对话内容区域 -->
    <a-layout-content class="custom-content">
      <Chat v-if="messageStore.currentSession.sessionId"/>
    </a-layout-content>

    <!-- 重命名会话模态框 -->
    <a-modal v-model:open="isRenameModalVisible" title="重命名会话" okText="确定" cancelText="取消" @ok="handleRename"
             @cancel="handleCancelRename">
      <a-input v-model:value="newSessionName" placeholder="输入新的会话名称"/>
    </a-modal>

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
import { ref, onMounted } from 'vue';
import Chat from '../chatwithbigdata/Chat.vue';
import { useMessageStore } from '@/store/MessageStore.js';
import { DatabaseOutlined, EditOutlined, EllipsisOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useRoute, useRouter } from 'vue-router';
import { eventBus } from "@/eventBus";
import { useProjectStore } from "@/store/ProjectStore";
import { useModelStore } from "@/store/ModelStore";

export default {
  components: {
    DatabaseOutlined,
    Chat,
    EllipsisOutlined,
    EditOutlined,
  },
  setup() {
    const messageStore = useMessageStore();
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
    const isRenameModalVisible = ref(false);
    const newSessionName = ref('');
    const sessionToRename = ref(null);
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
      if (!selectedModelId.value || !selectedProjectId.value.length) {
        message.error('请同时选择模型和项目');
        return;
      }

      try {
        loadingProjects.value = true;
        const selectedModel = modelStore.models.find(model => model.modelId === selectedModelId.value);
        const selectedProjects = projectStore.projects.filter(project => selectedProjectId.value.includes(project.projectId));

        if (!selectedModel || !selectedProjects.length) {
          message.error('模型或项目不存在');
          return;
        }

        await messageStore.createSession(selectedModel, selectedProjects);
        router.push({ query: { sessionId: messageStore.currentSession.sessionId } });
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
      router.push({ query: { sessionId: session.sessionId } });
      eventBus.emit('messageUpdated', session.messages.length - 1);
    };

    const deleteSession = async (index) => {
      await messageStore.deleteSession(index);
    };

    const showRenameModal = (index) => {
      const session = messageStore.sessions[index];
      sessionToRename.value = session;
      newSessionName.value = session?.title || '';
      isRenameModalVisible.value = true;
    };

    const handleCancelRename = () => {
      isRenameModalVisible.value = false;
      sessionToRename.value = null;
    };

    const handleRename = async () => {
      if (!newSessionName.value) {
        message.error('会话名称不能为空');
        return;
      }

      try {
        await messageStore.sessionRename(sessionToRename.value, newSessionName.value);
        isRenameModalVisible.value = false;
      } catch (error) {
        message.error('重命名失败，请稍后再试');
      }
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
      projectStore,
      modelStore,
      isRenameModalVisible,
      newSessionName,
      getSessionTitle,
      handleRename,
      handleCancelRename,
      showRenameModal,
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
  display: inline-block;
  max-width: 120px;
  min-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-item-dropdown {
  margin-left: auto;
}

.custom-content {
  padding: 20px;
}
</style>
