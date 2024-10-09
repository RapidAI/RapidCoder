<template>
  <a-layout class="full-height">
    <!-- 对话tab区域 -->
    <a-tabs v-model:activeKey="selectedSessionId" size="small" type="editable-card" @edit="onEdit">
      <a-tab-pane v-for="session in sessionStore.sessions" :key="session.sessionId" :tab="sessionTitle(session)"
                  :closable="true">
        <Chat :selectedSessionId="session.sessionId"/>
      </a-tab-pane>
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
import Chat from '../chat/Chat.vue';
import CustomLoading from '../common/CustomLoading.vue'; // 引入CustomLoading组件
import {useSessionStore} from '@/store/SessionStore.js';
import {useProjectStore} from "@/store/ProjectStore";
import {useModelStore} from "@/store/ModelStore";
import {useRoute, useRouter} from 'vue-router';
import {EditOutlined} from '@ant-design/icons-vue';
import {message} from 'ant-design-vue';

export default {
  components: {Chat, EditOutlined, CustomLoading}, // 注册CustomLoading组件
  setup() {
    const sessionStore = useSessionStore();
    const projectStore = useProjectStore();
    const modelStore = useModelStore();
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
        const session = sessionStore.sessions.find(s => String(s.sessionId) === sessionId);
        if (session) {
          selectSession(session);
        }
      } else if (sessionStore.sessions.length) {
        selectSession(sessionStore.sessions[sessionStore.sessions.length - 1]);
      }
    };

    const resetModal = () => {
      isSessionCreationModalVisible.value = false;
      selectedModelId.value = null;
      selectedProjectId.value = [];
    };

    const createSession = async () => {
      if (!selectedModelId.value) return message.error('请选择模型');
      try {
        const model = modelStore.models.find(m => m.modelId === selectedModelId.value);
        const newSession = sessionStore.createSession(model, selectedProjectId.value);
        selectedSessionId.value = newSession.sessionId
        router.push({query: {sessionId: selectedSessionId.value}});
      } catch (e) {
        message.error('创建会话失败');
      } finally {
        resetModal();
      }
    };

    const sessionTitle = (session) => session.messages[1]?.content || '新对话';

    const selectSession = (session) => {
      selectedSessionId.value = session.sessionId;
      router.push({query: {sessionId: session.sessionId}});
    };

    const deleteSession = (session) => {
      sessionStore.sessions = sessionStore.sessions.filter(s => s.sessionId !== session.sessionId);
    };

    const onEdit = (targetKey, action) => {
      if (action === 'remove') {
        const session = sessionStore.sessions.find(s => s.sessionId === targetKey);
        deleteSession(session);
      }
      if (action === 'add') {
        isSessionCreationModalVisible.value = true
      }
    };

    onMounted(async () => {
      await locateSessionFromUrl();
    });

    return {
      sessionStore,
      isSessionCreationModalVisible,
      selectedModelId,
      selectedProjectId,
      selectedSessionId,
      modelOptions,
      projectOptions,
      sessionTitle,
      createSession,
      resetModal,
      deleteSession,
      selectSession,
      onEdit
    };
  },
};
</script>
