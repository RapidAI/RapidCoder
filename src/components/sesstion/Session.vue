<template>
  <a-layout class="full-height">
    <a-layout-sider theme="light">
      <!-- 新建对话 -->
      <a-button class="new_sesstion_button" type="primary" :loading="loadingProjects" @click="createNewSession">
        <template #icon>
          <EditOutlined/>
        </template>
        新对话
      </a-button>
      <!-- 对话列表 -->
      <a-menu v-if="messageStore.sesstions.length" mode="inline" :selectedKeys="[messageStore.currentSession?.sesstionId]"
              class="custom-menu">
        <a-menu-item v-for="(sesstion, index) in messageStore.sesstions" :key="sesstion.sesstionId">
          <div class="menu-item-container">
            <span class="menu-item-title" @click="selectSession(sesstion)">
              {{ getSessionTitle(sesstion) }}
            </span>
            <a-dropdown class="menu-item-dropdown">
              <EllipsisOutlined/>
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="showRenameModal(index)">重命名</a-menu-item>
                  <a-menu-item>
                    <a-popconfirm title="确定要删除这个会话吗？" okText="确定" cancelText="取消"
                                  @confirm="sesstionDelete(index)">
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
      <Chat v-if="messageStore.sesstions.length>0"/>
    </a-layout-content>
  </a-layout>
  <!-- 重命名会话模态框 -->
  <a-modal v-model:open="isRenameModalVisible" title="重命名会话" okText="确定" cancelText="取消" @ok="handleRename"
           @cancel="handleCancelRename">
    <a-input v-model:value="newSessionName" placeholder="输入新的会话名称"/>
  </a-modal>
</template>

<script>
import {onMounted, ref} from 'vue';
import Chat from '../chatwithbigdata/Chat.vue';
import {useMessageStore} from '@/store/MessageStore.js';
import {DatabaseOutlined, EditOutlined, EllipsisOutlined} from '@ant-design/icons-vue';
import {message} from 'ant-design-vue';
import {useRoute, useRouter} from 'vue-router';

export default {
  components: {
    DatabaseOutlined,
    Chat,
    EllipsisOutlined,
    EditOutlined,
  },
  setup() {
    const messageStore = useMessageStore();
    const isRenameModalVisible = ref(false);
    const newSessionName = ref('');
    const sesstionToRename = ref(null);
    const loadingProjects = ref(false);
    const route = useRoute();
    const router = useRouter();

    // 根据URL参数定位到具体的会话
    const locateSessionFromUrl = async () => {
      const sesstionId = route.query.sesstionId;
      if (sesstionId) {
        const sesstion = messageStore.sesstions.find(s => String(s.sesstionId) === sesstionId);
        if (sesstion) {
          selectSession(sesstion);
        } else {
          message.error('会话不存在');
        }
      }
    };

    // 创建新的会话
    const createNewSession = async () => {
      loadingProjects.value = true;
      await messageStore.sesstionCreate();
      loadingProjects.value = false;
      router.push({query: {sesstionId: messageStore.currentSession.sesstionId}})
    };

    // 获取会话标题
    const getSessionTitle = (sesstion) => {
      return sesstion.messages[1]?.content || '新对话'
    }

    // 选择会话
    const selectSession = (sesstion) => {
      messageStore.currentSession = sesstion;
      router.push({query: {sesstionId: sesstion.sesstionId}});
    };

    // 删除会话
    const sesstionDelete = async (index) => {
      await messageStore.sesstionDelete(index);
    };

    // 显示重命名会话的模态框
    const showRenameModal = (index) => {
      const sesstion = messageStore.currentSession [index];
      sesstionToRename.value = sesstion;
      newSessionName.value = sesstion.title;
      isRenameModalVisible.value = true;
    };

    // 关闭重命名会话的模态框
    const handleCancelRename = () => {
      isRenameModalVisible.value = false;
      sesstionToRename.value = null;
    };

    // 处理重命名会话
    const handleRename = async () => {
      if (!newSessionName.value) {
        message.error('会话名称不能为空');
        return;
      }

      await messageStore.sesstionRename(sesstionToRename.value, newSessionName.value);
      isRenameModalVisible.value = false;
      sesstionToRename.value = null;
    };

    // 组件挂载时加载会话和数据库
    onMounted(async () => {
      loadingProjects.value = true;
      await messageStore.modelsLoad();
      await messageStore.projectsLoad();
      await locateSessionFromUrl();
      loadingProjects.value = false;
    });

    return {
      messageStore,
      selectSession,
      sesstionDelete,
      isRenameModalVisible,
      newSessionName,
      getSessionTitle,
      handleRename,
      handleCancelRename,
      showRenameModal,
      createNewSession,
      loadingProjects,
    };
  },
};
</script>

<style scoped lang="scss">
.new_sesstion_button {
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