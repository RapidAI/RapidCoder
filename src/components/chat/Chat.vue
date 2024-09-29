<template>
  <a-layout class="custom-content">
    <a-layout-sider class="chat-project" theme="light" width="400">
      <chat-project v-if="selectedSessionId" :selectedSessionId="selectedSessionId"></chat-project>
    </a-layout-sider>
    <a-layout-content class="chat-container">
      <div class="top-bar">
        {{ currentSession ? currentSession.currentModel.modelName : 'No session selected' }}
        <a-switch
            v-model:checked="debugMode"
            class="debug-switch"
            checked-children="调试模式"
            un-checked-children="普通模式"
        />
      </div>
      <chat-message-list
          class="message-list"
          :debugMode="debugMode"
          v-if="selectedSessionId"
          :selectedSessionId="selectedSessionId"
      />
      <chat-message-input
          class="message-input"
          v-if="selectedSessionId"
          :selectedSessionId="selectedSessionId"
      />
    </a-layout-content>
  </a-layout>
</template>

<script>
import {ref, computed} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import ChatMessageList from './ChatMessageList.vue';
import ChatMessageInput from './ChatMessageInput.vue';
import ChatProject from './ChatProject.vue';
import {DeleteOutlined, EditOutlined} from "@ant-design/icons-vue";

export default {
  components: {
    DeleteOutlined, EditOutlined,
    ChatMessageList, ChatProject,
    ChatMessageInput,
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const sessionStore = useSessionStore();
    const debugMode = ref(true);

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    return {
      debugMode,
      currentSession,
    };
  },
};
</script>

<style scoped>
.chat-container {
  position: relative;
  overflow: hidden;
  background-color: white;
}
.chat-project {
  position: relative;
  background-color: white;
  overflow: scroll;
}

.top-bar {
  margin: 10px;
  display: flex;
  align-items: center;
}

.message-list {
  height: 85vh;
  overflow: auto;
}

.message-input {
  position: absolute;
  bottom: 0;
  width: 100%;
}

.debug-switch {
  position: absolute;
  right: 10px;
}
.custom-content {
  padding: 24px 10px;
}
</style>
