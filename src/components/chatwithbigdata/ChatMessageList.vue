<template>
  <div ref="messageList" class="custom-list">
    <div v-for="(item, index) in currentSession.messages" :key="index" class="message-item">
      <component :is="item.role === 'user' ? UserOutlined : RobotOutlined" class="role-icon"/>
      <div class="message-content">
        <div v-if="editedMessageIndex !== index">
          <template v-if="debugMode">
            <chat-markdown :markdown="item.content" :messageindex="index" :selectedSessionId="selectedSessionId"/>
          </template>
          <div v-if="!debugMode" class="analysis-status">
            <span :class="['status-text', { 'analyzing': item.isAnalyzing }]">
              {{ item.isAnalyzing ? '正在分析' : '分析完成' }}
            </span>
            <custom-loading v-if="item.isAnalyzing" class="loading-icon"/>
            <span v-else class="check-icon">✅</span>
          </div>
          <div class="message-actions">
            <template v-if="item.role === 'system'">
              <a @click="copyToClipboard(item.content)">复制</a>
            </template>
            <template v-if="item.role === 'user'">
              <a @click="enableEditMode(index, item.content)">编辑</a>
              <a @click="copyToClipboard(item.content)">复制</a>
            </template>
            <template v-if="item.role === 'assistant'">
              <a @click="copyToClipboard(item.content)">复制</a>
              <a @click="regenerateMessage(index)">重新生成</a>
            </template>
          </div>
        </div>
        <div v-else class="edit-container">
          <a-textarea v-model:value="editedMessageContent"
                      @keydown="handleKeyDown"
                      @compositionstart="handleComposition(true)"
                      @compositionend="handleComposition(false)"
                      :auto-size="{ minRows: 1, maxRows: 3 }"
                      class="edit-textarea"/>
          <div class="edit-actions">
            <a @click="updateMessage(index, item.role)">发送</a>
            <a @click="resetEdit">取消</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, onMounted, onUnmounted, nextTick, computed} from 'vue';
import {useMessageStore} from '@/store/MessageStore.js';
import {message} from 'ant-design-vue';
import {
  UserOutlined,
  RobotOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons-vue';
import {eventBus} from '@/eventBus.js';
import ChatMarkdown from './ChatMarkdown.vue';
import CustomLoading from "@/components/common/CustomLoading.vue";

export default {
  components: {
    CustomLoading,
    ChatMarkdown,
    UserOutlined,
    RobotOutlined,
    ArrowDownOutlined,
  },
  props: {
    debugMode: {
      type: Boolean,
      default: false,
    },
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const messageStore = useMessageStore();
    const messageList = ref([]);
    const editedMessageIndex = ref(null);
    const editedMessageContent = ref('');
    let isComposition = false;

    const currentSession = computed(() => {
      return messageStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const enableEditMode = (index, content) => {
      editedMessageIndex.value = index;
      editedMessageContent.value = content;
    };

    const updateMessage = (index, role) => {
      if (role === 'user' && editedMessageContent.value.trim()) {
        currentSession.value.messages[index].content = editedMessageContent.value;
        currentSession.value.messages.splice(index + 1);
        messageStore.selectFileAndChat(currentSession.value, index, false, false);
        resetEdit();
      }
    };

    const resetEdit = () => {
      editedMessageIndex.value = null;
      editedMessageContent.value = '';
    };

    const copyToClipboard = (content) => {
      navigator.clipboard
          .writeText(content)
          .then(() => {
            message.success('内容已复制到剪切板');
          })
          .catch(() => {
            message.error('复制失败');
          });
    };

    const regenerateMessage = (index) => {
      currentSession.value.messages.splice(index);
      messageStore.processChat(
          currentSession.value,
          currentSession.value.messages,
          index,
          true,
          false
      );
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !isComposition && !event.shiftKey) {
        event.preventDefault();
        updateMessage(editedMessageIndex.value, 'user');
      }
    };

    const handleComposition = (status) => {
      isComposition = status;
    };

    const scrollToCurrentMessage = (index) => {
      nextTick(() => {
        const messageItems =
            messageList.value?.querySelectorAll('.message-item');
        messageItems[index].scrollIntoView({behavior: 'instant', block: 'end'});
      });
    };

    onMounted(() => {
      eventBus.on('messageUpdated', scrollToCurrentMessage);
    });

    onUnmounted(() => {
      eventBus.off('messageUpdated', scrollToCurrentMessage);
    });

    return {
      messageList,
      currentSession,
      editedMessageIndex,
      editedMessageContent,
      enableEditMode,
      RobotOutlined,
      UserOutlined,
      updateMessage,
      resetEdit,
      copyToClipboard,
      regenerateMessage,
      handleKeyDown,
      handleComposition,
      messageStore,
    };
  },
};
</script>

<style scoped>
.custom-list {
  height: 83vh;
  overflow: auto;
}

.message-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
  overflow: hidden;
}

.role-icon {
  margin-right: 8px;
  font-size: large;
  margin-top: 4px;
}

.message-content {
  flex: 1;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 15px;
  line-height: 28px;
}

.message-actions {
  margin-top: 8px;
  display: flex;
  gap: 10px;
}

.edit-container {
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 8px;
}

.edit-textarea {
  margin-bottom: 8px;
}

.edit-actions {
  display: flex;
  justify-content: flex-start; /* 将按钮靠左对齐 */
  gap: 10px;
}

.user-container {
  color: black;
}

.analysis-status {
  color: gray;
}

.status-text {
  font-weight: bold;
}

.status-text.analyzing {
  color: #1890ff; /* 蓝色 */
}

.loading-icon {
  margin-left: 8px;
}

.check-icon {
  margin-left: 8px;
  color: green;
}
</style>