<template>
  <a-layout-content class="full-height">
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
</template>
<script>
import {ref, computed} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import ChatMessageList from '../chatcomponents/ChatMessageList.vue';
import ChatMessageInput from '../chatcomponents/ChatMessageInput.vue';

export default {
  components: {
    ChatMessageList,ChatMessageInput
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
  }
}
</script>
<style scoped>
.full-height{
  background-color: white;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
