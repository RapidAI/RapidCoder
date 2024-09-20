<template>
  <a-layout class="full-height">
    <!-- 侧边栏 -->
    <a-layout-sider theme="light" width="300">
      <!-- 新建对话 -->
      <div class="fixed-button-container">
        <a-button class="new_session_button" type="primary" :loading="loadingProjects"
                  @click="isSessionCreationModalVisible = true">
          <EditOutlined/>
          新对话
        </a-button>
      </div>
      <!-- 对话列表 -->
      <div class="scrollable-menu-container">
        <a-menu v-if="messageStore.sessions.length" mode="inline" :inlineIndent="0"
                :selectedKeys="[selectedSessionId]" class="custom-menu">
          <a-menu-item v-for="session in [...messageStore.sessions].reverse()" :key="session.sessionId">
            <div class="menu-item-container">
              <a-button type="link" @click="deleteSession(session)">
                <DeleteOutlined/>
              </a-button>
              <span class="menu-item-title" @click="selectSession(session)">{{ sessionTitle(session) }}</span>
            </div>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>

    <!-- 对话内容区域 -->
    <a-layout-content class="custom-content">
      <Chat v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
    </a-layout-content>

    <!-- 新建对话选择模型和项目模态框 -->
    <a-modal v-model:open="isSessionCreationModalVisible" title="选择模型和项目" okText="确定" cancelText="取消"
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
        <p><strong>请选择项目：</strong></p>
        <a-checkbox-group v-model:value="selectedProjectId" style="width: 100%">
          <a-checkbox v-for="project in projectOptions" :key="project.value" :value="project.value">
            {{ project.label }}
          </a-checkbox>
        </a-checkbox-group>
      </div>
    </a-modal>
  </a-layout>
</template>

<script>
import {ref, onMounted} from 'vue';
import Chat from '../chatwithbigdata/Chat.vue';
import {useMessageStore} from '@/store/MessageStore.js';
import {useProjectStore} from "@/store/ProjectStore";
import {useModelStore} from "@/store/ModelStore";
import {useRoute, useRouter} from 'vue-router';
import {EditOutlined, DeleteOutlined} from '@ant-design/icons-vue';
import {message} from 'ant-design-vue';
import {eventBus} from "@/eventBus";

export default {
  components: {Chat, EditOutlined, DeleteOutlined},
  setup() {
    const messageStore = useMessageStore();
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
    const loadingProjects = ref(false);
    const isSessionCreationModalVisible = ref(false);
    const selectedSessionId = ref(null);
    const selectedModelId = ref(null);
    const selectedProjectId = ref([]);

    const router = useRouter();
    const route = useRoute();

    const modelOptions = modelStore.models.map(({modelName, modelId}) => ({label: modelName, value: modelId}));
    const projectOptions = projectStore.projects.map(({projectDescription, projectId}) => ({
      label: projectDescription,
      value: projectId
    }));

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

    const resetModal = () => {
      isSessionCreationModalVisible.value = false;
      selectedModelId.value = null;
      selectedProjectId.value = [];
    };

    const createSession = async () => {
      if (!selectedModelId.value) return message.error('请选择模型');
      loadingProjects.value = true;
      try {
        const model = modelStore.models.find(m => m.modelId === selectedModelId.value);
        const projects = projectStore.projects.filter(p => selectedProjectId.value.includes(p.projectId));
        const newSession = await messageStore.createSession(model, projects);
        selectedSessionId.value = newSession.sessionId
        router.push({query: {sessionId: selectedSessionId.value}});
      } catch (e) {
        message.error('创建会话失败');
      } finally {
        loadingProjects.value = false;
        resetModal();
      }
    };

    const sessionTitle = (session) => session.messages[1]?.content || '新对话';

    const selectSession = (session) => {
      selectedSessionId.value = session.sessionId;
      router.push({query: {sessionId: session.sessionId}});
      eventBus.emit('messageUpdated', session.messages.length-1);
    };

    const deleteSession = (session) => {
      messageStore.sessions = messageStore.sessions.filter(s => s.sessionId !== session.sessionId);
    };

    onMounted(async () => {
      loadingProjects.value = true;
      try {
        await locateSessionFromUrl();
      } finally {
        loadingProjects.value = false;
      }
    });

    return {
      messageStore,
      isSessionCreationModalVisible,
      loadingProjects,
      selectedModelId,
      selectedProjectId,
      selectedSessionId,
      modelOptions,
      projectOptions,
      sessionTitle,
      createSession,
      resetModal,
      deleteSession,
      selectSession
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
  max-height: calc(100vh - 60px);
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
