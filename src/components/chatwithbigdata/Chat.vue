<template>
  <div class="chat-container">
    <div class="top-bar">
      <a-select
          v-model:value="messageStore.session.modelId"
          placeholder="请选择一个模型"
          :allow-clear="true"
          @change="updateCurrentModel"
      >
        <a-select-option
            v-for="model in messageStore.models"
            :key="model.modelId"
            :value="model.modelId"
        >
          {{ model.modelName }}
        </a-select-option>
      </a-select>
      <!--        fixme 去掉session中的databaseInfo-->
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
import {useMessageStore} from '@/store/MessageStoreWithBigData.js';
import ChatMessageList from './ChatMessageList.vue';
import ChatMessageInput from './ChatMessageInput.vue';

export default {
  components: {
    ChatMessageList,
    ChatMessageInput,
  },
  setup() {
    const messageStore = useMessageStore();
    const debugMode = ref(false);
    // 更新当前模型
    const updateCurrentModel = (modelId) => {
      const model = messageStore.models.find((model) => model.modelId === modelId);
      messageStore.currentModel = model || null;
    };
    return {
      updateCurrentModel,
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