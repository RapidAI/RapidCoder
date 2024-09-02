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
    <a-button type="primary" @click="handleSendOrStop">{{ messageStore.isStreaming ? '终止' : '发送' }}</a-button>
  </div>
</template>

<script>
import {ref, computed} from 'vue';
import {useMessageStore} from '@/store/MessageStoreWithBigData.js';

export default {
  setup() {
    const messageStore = useMessageStore();
    const inputMessage = ref('');
    const isComposition = ref(false);


    const handleSendOrStop = async () => {
      if (messageStore.isStreaming) {
        await messageStore.messageStopChat();
      } else {
        handleSend(inputMessage.value);
      }
    };

    const handleSend = async (message) => {
      if (message.trim()) {
        messageStore.messages.push({role: 'user', content: message})
        inputMessage.value = ''; // 清空输入框
        await messageStore.messageSearchDatabaseAndmessageInputAndChat(messageStore.messages, messageStore.messages.length-1, false, true);
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
      handleKeyDown,
      handleCompositionStart,
      handleCompositionEnd,
      messageStore,
    };
  },
};
</script>

<style scoped>
.input-container {
  display: flex;
  align-items: flex-start;
  width: 100%;
}

.message-input {
  flex: 1;
  margin-right: 10px;
}
</style>
