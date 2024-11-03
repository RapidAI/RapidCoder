<template>
  <a-layout-content class="chat-container">
    <div class="top-bar">
      <a-select
          type="text"
          v-model:value="selectedModelId"
          style="width: 200px"
          placeholder="选择模型"
          @change="handleModelChange"
      >
        <a-select-option
            v-for="model in models"
            :key="model.modelId"
            :value="model.modelId"
        >
          {{ model.model }}
        </a-select-option>
      </a-select>
      <a-switch
          v-model:checked="parameterStore.debugMode"
          class="debug-switch"
          checked-children="调试"
          un-checked-children=""
      />
      <a-switch
          v-model:checked="parameterStore.autoReplace"
          class="debug-switch"
          checked-children="自动"
          un-checked-children=""
      />
    </div>
    <chat-message-list
        class="message-list"
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
import {ref, computed, watch} from 'vue';
import {useParameterStore} from '@/store/ParameterStore';
import {useSessionStore} from '@/store/SessionStore.js';
import {useModelStore} from '@/store/ModelStore.js';
import ChatMessageList from '../chatcomponents/ChatMessageList.vue';
import ChatMessageInput from '../chatcomponents/ChatMessageInput.vue';

export default {
  components: {
    ChatMessageList, ChatMessageInput
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const parameterStore = useParameterStore();
    const sessionStore = useSessionStore();
    const modelStore = useModelStore();
    const selectedModelId = ref(null);

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const models = computed(() => modelStore.models);

    watch(
        () => currentSession.value,
        (newSession) => {
          if (newSession) {
            selectedModelId.value = newSession.currentModel.modelId;
          }
        },
        {immediate: true}
    );

    const handleModelChange = (modelId) => {
      const selectedModel = models.value.find(model => model.modelId === modelId);
      if (selectedModel && currentSession.value) {
        currentSession.value.currentModel = selectedModel;
      }
    };

    return {
      parameterStore,
      currentSession,
      models,
      selectedModelId,
      handleModelChange,
    };
  }
}
</script>

<style scoped>
.chat-container {
  height: 100%;
  overflow: auto;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: white;
  height: 35px;
  font-size: 15px;
}

.message-list {
  height: calc(100% - 35px - 70px);
  overflow-y: auto;
}

.message-input {
  bottom: 0;
  width: 100%;
  height: 50px;
  padding: 10px;
}
</style>
