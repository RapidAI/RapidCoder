<template>
  <a-layout class="full-height">
    <a-layout-sider theme="light">
      <!-- 新建对话 -->
      <a-button class="new_session_button" type="primary" :loading="loadingDatabases" @click="createNewSession">
        <template #icon>
          <EditOutlined/>
        </template>
        新对话
      </a-button>
      <!-- 对话列表 -->
      <a-menu v-if="messageStore.sessions.length" mode="inline" :selectedKeys="[messageStore.session?.sessionId]" class="custom-menu">
        <a-menu-item v-for="(session, index) in messageStore.sessions" :key="session.sessionId">
          <div class="menu-item-container">
            <span class="menu-item-title" @click="selectSession(session)">
              {{ getSessionTitle(session) }}
            </span>
            <a-dropdown class="menu-item-dropdown">
              <EllipsisOutlined/>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="showRenameModal(index)">重命名</a-menu-item>
                  <a-menu-item>
                    <a-popconfirm title="确定要删除这个会话吗？" okText="确定" cancelText="取消"
                                  @confirm="sessionDelete(index)">
                      <span>删除</span>
                    </a-popconfirm>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <!-- 对话内容区域 -->
    <a-layout-content class="custom-content">
      <Chat v-if="messageStore.session" />
    </a-layout-content>
  </a-layout>
  <!-- 重命名会话模态框 -->
  <a-modal v-model:open="isRenameModalVisible" title="重命名会话" okText="确定" cancelText="取消" @ok="handleRename"
           @cancel="handleCancelRename">
    <a-input v-model:value="newSessionName" placeholder="输入新的会话名称"/>
  </a-modal>
</template>

<script>
import { onMounted, ref } from 'vue';
import Chat from '../chatwithbigdata/Chat.vue';
import { useMessageStore } from '@/store/MessageStoreWithBigData.js';
import { useUserStore } from '@/store/UserStore.js';
import { DatabaseOutlined, EditOutlined, EllipsisOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useRoute, useRouter } from 'vue-router';

export default {
  components: {
    DatabaseOutlined,
    Chat,
    EllipsisOutlined,
    EditOutlined,
  },
  setup() {
    const userStore = useUserStore();
    const messageStore = useMessageStore();
    const isRenameModalVisible = ref(false);
    const newSessionName = ref('');
    const sessionToRename = ref(null);
    const loadingDatabases = ref(false);
    const route = useRoute();
    const router = useRouter();

    // 根据URL参数定位到具体的会话
    const locateSessionFromUrl = async () => {
      const sessionId = route.query.sessionId;
      if (sessionId) {
        const session = messageStore.sessions.find(s => String(s.sessionId) === sessionId);
        if (session) {
          selectSession(session);
        } else {
          message.error('会话不存在');
        }
      }
    };

    // 创建新的会话
    const createNewSession = async () => {
      loadingDatabases.value = true;
      await messageStore.sessionCreate(userStore.userData.userId);
      loadingDatabases.value = false;
      router.push({ query: { sessionId: messageStore.session.sessionId } })
    };

    // 获取会话标题
    const getSessionTitle = (session) => {
      return JSON.parse(session.messages)[1]?.content || '新对话'
    }

    // 选择会话
    const selectSession = (session) => {
      messageStore.session = session;
      messageStore.messagesInit(session);
      router.push({query: {sessionId: session.sessionId}});
    };

    // 删除会话
    const sessionDelete = async (index) => {
      await messageStore.sessionDelete(index);
    };

    // 显示重命名会话的模态框
    const showRenameModal = (index) => {
      const session = messageStore.sessions[index];
      sessionToRename.value = session;
      newSessionName.value = session.title;
      isRenameModalVisible.value = true;
    };

    // 关闭重命名会话的模态框
    const handleCancelRename = () => {
      isRenameModalVisible.value = false;
      sessionToRename.value = null;
    };

    // 处理重命名会话
    const handleRename = async () => {
      if (!newSessionName.value) {
        message.error('会话名称不能为空');
        return;
      }

      await messageStore.sessionRename(sessionToRename.value, newSessionName.value);
      isRenameModalVisible.value = false;
      sessionToRename.value = null;
    };

    // 组件挂载时加载会话和数据库
    onMounted(async () => {
      loadingDatabases.value = true;
      await messageStore.modelsLoad();
      await messageStore.databasesLoad();
      await messageStore.sessionsLoad(userStore.userData.userId);
      await locateSessionFromUrl();
      loadingDatabases.value = false;
    });

    return {
      messageStore,
      selectSession,
      sessionDelete,
      isRenameModalVisible,
      newSessionName,
      getSessionTitle,
      handleRename,
      handleCancelRename,
      showRenameModal,
      createNewSession,
      loadingDatabases,
    };
  },
};
</script>

<style scoped lang="scss">
.new_session_button {
  width: 100%;
  margin-top: 10px;

  :deep(.ant-btn-primary:first-child) {
    width: 90%;
  }
}

.menu-item-title {
  display: inline-block;
  max-width: 120px;
  min-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.menu-item-dropdown {
  margin-left: auto;

  :deep(.ant-btn-primary:first-child) {
    width: 95%;
  }
}
</style>