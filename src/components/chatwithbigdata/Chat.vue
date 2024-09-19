<template>
  <div class="chat-container">
    <div class="top-bar">
      {{messageStore.currentSession.currentModel.modelName}}
    </div>
    <a-switch
        v-model:checked="debugMode"
        class="debug-switch"
        checked-children="调试模式"
        un-checked-children="普通模式"
    />
    <chat-message-list class="message-list" :debugMode="debugMode"/>
    <chat-message-input class="message-input"/>
  </div>
</template>

<script>
import {ref} from 'vue';
import {useMessageStore} from '@/store/MessageStore.js';
import ChatMessageList from './ChatMessageList.vue';
import ChatMessageInput from './ChatMessageInput.vue';

export default {
  components: {
    ChatMessageList,
    ChatMessageInput,
  },
  setup() {
    const messageStore = useMessageStore();
    const debugMode = ref(true);
    return {
      debugMode,
      messageStore,
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
  display: flex;
  align-items: center;
}

.session-info {
  margin-left: 20px;
  display: flex;
  gap: 10px;
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
  top: 10px;
  right: 10px;
}
</style>