<template>
  <div ref="messageList" class="custom-list">
    <div v-for="(item, index) in currentSession.messages" :key="index" class="message-item">
      <div class="message-content" v-if="item.role !== 'system'">
        <div v-if="editedMessageIndex !== index" :class="item.role === 'user'?'edit-container':''">
          <!--内容-->
          <template v-if="debugMode">
            <chat-markdown :markdown="item.content" :messageindex="index"/>
          </template>
          <!--展示-->
          <div v-if="!debugMode" class="analysis-status">
            <span :class="['status-text', { 'analyzing': item.isAnalyzing }]">
              {{ item.isAnalyzing ? '正在分析' : '分析完成' }}
            </span>
            <custom-loading v-if="item.isAnalyzing" class="loading-icon"/>
            <span v-else class="check-icon">✅</span>
          </div>
          <!--功能-->
          <div class="message-actions">
            <template v-if="item.role === 'user'">
              <a-button type="primary" size="small" @click="enableEditMode(index, item.content)">编辑</a-button>
              <a-button type="primary" size="small" @click="copyToClipboard(item.content)">复制</a-button>
            </template>
            <template v-if="item.role === 'assistant'">
              <a-button type="primary" size="small" @click="enableEditMode(index, item.content)">编辑</a-button>
              <a-button type="primary" size="small" @click="copyToClipboard(item.content)">复制</a-button>
              <a-button type="primary" size="small" @click="regenerateMessage(index)">重新生成</a-button>
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
            <a-button type="primary" size="small" @click="updateMessage(index, item.role)">发送</a-button>
            <a-button type="primary" size="small" @click="resetEdit">取消</a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, onMounted, onUnmounted, nextTick, computed} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import {message} from 'ant-design-vue';
import {
  ArrowDownOutlined,
} from '@ant-design/icons-vue';
import {eventBus} from '@/eventBus.js';
import ChatMarkdown from './ChatMarkdown.vue';
import CustomLoading from "@/components/common/CustomLoading.vue";

export default {
  components: {
    CustomLoading,
    ChatMarkdown,
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
    const sessionStore = useSessionStore();
    const messageList = ref([]);
    const editedMessageIndex = ref(null);
    const editedMessageContent = ref('');
    let isComposition = false;

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const enableEditMode = (index, content) => {
      editedMessageIndex.value = index;
      editedMessageContent.value = content;
    };

    const updateMessage = (index, role) => {
      if (role === 'user' && editedMessageContent.value.trim()) {
        currentSession.value.messages[index].content = editedMessageContent.value;
        currentSession.value.messages.splice(index + 1);
        sessionStore.agent1(currentSession.value, index, false);
        resetEdit();
      }
      if (role === 'assistant' && editedMessageContent.value.trim()) {
        currentSession.value.messages[index].content = editedMessageContent.value;
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
      sessionStore.processChat(
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

    const messageItems = computed(() => {
      if (messageList.value) {
        return messageList.value.querySelectorAll('.message-item');
      }
      return [];
    });

    const scrollToCurrentMessage = (sessionId, index) => {
      nextTick(() => {
        if (currentSession.value && currentSession.value.sessionId === sessionId) {
          if (messageItems.value && messageItems.value[index]) {
            const messageItem = messageItems.value[index];
            const rect = messageItem.getBoundingClientRect();
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

            if (!isVisible) {
              messageItem.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          }
        }
      });
    };
    onMounted(() => {
      eventBus.on('messageUpdated', ({sessionId, index}) => {
        scrollToCurrentMessage(sessionId, index);
      });
      scrollToCurrentMessage(currentSession.value.sessionId, currentSession.value.messages.length - 1)
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
      updateMessage,
      resetEdit,
      copyToClipboard,
      regenerateMessage,
      handleKeyDown,
      handleComposition,
      sessionStore,
    };
  },
};
</script>

<style scoped>
.custom-list {
  height: 83vh;
  overflow-y: auto;
}
</style>