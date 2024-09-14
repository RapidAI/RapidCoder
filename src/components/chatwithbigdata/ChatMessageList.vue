<template>
  <div ref="messageList" class="custom-list">
    <div
        v-for="(item, index) in messageStore.currentSession.messages"
        :key="index"
        class="message-item"
    >
      <component
          :is="item.role === 'user' ? UserOutlined : RobotOutlined"
          class="role-icon"
      />
      <div class="message-content">
        <div v-if="editedMessageIndex !== index">
          <chat-markdown
              v-if="debugMode"
              :markdown="item.content"
              :debugMode="debugMode"
              :messagelistindex="index"
          />
          <div v-if="!debugMode" class="analysis-complete">
            {{ item.isAnalyzing ? '正在分析' : '分析完成' }}
            <a-spin v-if="item.isAnalyzing" class="loading-icon" />
            <span v-else class="check-icon">✅</span>
          </div>
          <div class="message-actions">
            <a v-if="item.role === 'user'" @click="enableEditMode(index, item.content)"
            >编辑</a
            >
            <a @click="copyToClipboard(item.content)">复制</a>
          </div>
        </div>
        <div v-else class="edit-container">
          <a-textarea
              v-model:value="editedMessageContent"
              @keydown="handleKeyDown"
              @compositionstart="handleComposition(true)"
              @compositionend="handleComposition(false)"
              :auto-size="{ minRows: 1, maxRows: 3 }"
              class="edit-textarea"
          />
          <div class="edit-actions">
            <a @click="updateMessage(index, item.role)">发送</a>
            <a @click="cancelEdit">取消</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useMessageStore } from '@/store/MessageStore.js';
import { message } from 'ant-design-vue';
import {
  UserOutlined,
  RobotOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons-vue';
import { eventBus } from '@/eventBus.js';
import ChatMarkdown from './ChatMarkdown.vue';

export default {
  components: {
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
  },
  setup(props) {
    const messageStore = useMessageStore();
    const messageList = ref([]);
    const editedMessageIndex = ref(null);
    const editedMessageContent = ref('');
    let isComposition = false;

    const enableEditMode = (index, content) => {
      editedMessageIndex.value = index;
      editedMessageContent.value = content;
    };

    const updateMessage = (index, role) => {
      if (role === 'user' && editedMessageContent.value.trim()) {
        messageStore.currentSession.messages[index].content =
            editedMessageContent.value;
        messageStore.currentSession.messages[index].retryCount = 0; // 重置
        messageStore.currentSession.messages.splice(index + 1);
        messageStore.selectFileAndChat(
            messageStore.currentSession.messages,
            index,
            false,
            false
        );
        cancelEdit();
      }
    };

    const cancelEdit = () => {
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
        messageItems[index].scrollIntoView({ behavior: 'instant', block: 'end' });
      });
    };

    onMounted(() => {
      scrollToCurrentMessage(messageStore.currentSession.messages.length - 1);
      eventBus.on('messageUpdated', scrollToCurrentMessage);
    });

    onUnmounted(() => {
      eventBus.off('messageUpdated', scrollToCurrentMessage);
    });

    return {
      messageList,
      editedMessageIndex,
      editedMessageContent,
      enableEditMode,
      RobotOutlined,
      UserOutlined,
      updateMessage,
      cancelEdit,
      copyToClipboard,
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

.analysis-complete {
  color: gray;
  font-style: italic;
}

.loading-icon {
  margin-left: 8px;
}

.check-icon {
  margin-left: 8px;
}
</style>
