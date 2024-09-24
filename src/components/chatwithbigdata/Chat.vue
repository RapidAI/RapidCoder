<template>
  <div class="chat-container">
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
  </div>
</template>

<script>
import {ref, computed} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import ChatMessageList from './ChatMessageList.vue';
import ChatMessageInput from './ChatMessageInput.vue';

export default {
  components: {
    ChatMessageList,
    ChatMessageInput,
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const messageStore = useSessionStore();
    const debugMode = ref(true);

    const currentSession = computed(() => {
      return messageStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
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
  height: 93vh;
  overflow: hidden;
}

.top-bar {
  margin: 10px;
  display: flex;
  align-items: center;
}

.message-list {
  height: 83vh;
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
</style>
