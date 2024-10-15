<template>
  <div class="input-container">
    <a-textarea
        v-model:value="inputMessage"
        placeholder="输入消息..."
        @keydown="handleKeyDown"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
        class="message-input"
        :auto-size="{ minRows: 1, maxRows: 3 }"
    />
    <a-button type="primary" @click="handleSendOrStop" :disabled="isSending">
      {{ currentSession.isStreaming ? '终止' : '发送' }}
    </a-button>
  </div>
</template>

<script>
import {ref, computed} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const sessionStore = useSessionStore();
    const inputMessage = ref('');
    const isComposition = ref(false);
    const isSending = ref(false);

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const handleSendOrStop = async () => {
      if (currentSession.value.isStreaming) {
        await sessionStore.stopChat(currentSession.value);
      } else {
        if (isSending.value) return; // 防止重复发送
        handleSend(inputMessage.value);
      }
    };

    const handleSend = async (message) => {
      if (message.trim() && currentSession.value) {
        try {
          isSending.value = true;
          currentSession.value.messages.push({role: 'user', content: message});
          inputMessage.value = ''; // 清空输入框
          isSending.value = false;
          await sessionStore.selectFileAndChat(currentSession.value, currentSession.value.messages.length - 1, false, false);
        } catch (error) {
          console.error('消息发送失败:', error);
          alert('发送消息时出现问题，请稍后再试。');
        } finally {
          isSending.value = false;
        }
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !isComposition.value && !event.shiftKey) {
        event.preventDefault(); // 阻止默认的换行行为
        handleSendOrStop();
      }
    };

    const handleCompositionStart = () => {
      isComposition.value = true;
    };

    const handleCompositionEnd = () => {
      isComposition.value = false;
    };

    return {
      inputMessage,
      handleSendOrStop,
      currentSession,
      handleKeyDown,
      handleCompositionStart,
      handleCompositionEnd,
      sessionStore,
      isSending,
    };
  },
};
</script>

<style scoped>
.input-container {
  display: flex;
  align-items: flex-start;
  width: 100%;
  border-radius: 5px;
}

.message-input {
  flex: 1;
  margin-right: 10px;
  border-radius: 5px;
  padding: 10px;
  font-family: 'Orbitron', sans-serif;
  transition: all 0.3s ease;
}

.message-input:focus {
  border-color: black;
  box-shadow: 0 0 10px rgba(2, 2, 2, 0.8);
}

.message-input:hover {
  border-color: black;
}
</style>
