<template>
  <div ref="messageList" class="custom-list">
    <div v-for="(item, index) in messageStore.messages" :key="index" class="message-item">
      <component :is="item.role === 'user' ? UserOutlined : RobotOutlined" class="role-icon"/>
      <div class="message-content">
        <div v-if="editedMessageIndex !== index">
          <template v-if="item.role === 'system'">
            <chat-system-message v-show="debugMode"/>
            <chat-markdown v-show="!debugMode" :markdown="collapsed ? item.content : '数据库信息'"
                           :messagelistindex="index"/>
          </template>
          <template v-else>
            <chat-markdown v-if="shouldRenderMarkdown(item)" :markdown="item.content" :debugMode="debugMode"
                           :messagelistindex="index"/>
            <div v-else-if="!debugMode && containsCodeData(item.content)" class="analysis-complete">
              {{ item.isAnalyzing ? '正在分析' : '分析完成' }}
              <a-spin v-if="item.isAnalyzing" class="loading-icon"/>
              <span v-else class="check-icon">✅</span>
            </div>
            <div v-else-if="item.role === 'user'" class="user-container" v-html="formatUserMessage(item.content)"></div>
          </template>
          <div class="message-actions">
            <a v-if="item.role === 'user'" @click="enableEditMode(index, item.content)">编辑</a>
            <a v-if="!isNonCopyableAssistant(item)" @click="copyToClipboard(item.content)">复制</a>
            <a-dropdown v-if="messageContainsSQLdata(item.content)">
              <a class="ant-dropdown-link" @click.prevent>
                转成图表
                <ArrowDownOutlined/>
              </a>
              <template #overlay>
                <a-menu @click="handleChartTypeSelect($event, index)">
                  <a-menu-item key="bar">柱状图</a-menu-item>
                  <a-menu-item key="pie">饼图</a-menu-item>
                  <a-menu-item key="line">折线图</a-menu-item>
                  <a-menu-item key="radar">雷达图</a-menu-item>
                  <a-menu-item key="polarArea">极坐标图</a-menu-item>
                  <a-menu-item key="scatter">散点图</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <a v-if="item.role === 'system' && !debugMode" @click="systemToggleCollapse">{{
                collapsed ? '折叠' : '展开'
              }}</a>
            <a v-if="messageContainsSQLdata(item.content)" @click="analyzeData(index)">解析数据</a>
          </div>
        </div>
        <div v-else class="edit-container">
          <a-textarea v-model:value="editedMessageContent" @keydown="handleKeyDown"
                      @compositionstart="handleComposition(true)" @compositionend="handleComposition(false)"
                      :auto-size="{ minRows: 1, maxRows: 3 }" class="edit-textarea"/>
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
import {ref, onMounted, onUnmounted, nextTick} from 'vue';
import {useMessageStore} from '@/store/MessageStoreWithBigData.js';
import {message} from 'ant-design-vue';
import {UserOutlined, RobotOutlined, ArrowDownOutlined} from '@ant-design/icons-vue';
import {eventBus} from '@/eventBus.js';
import ChatSystemMessage from "./ChatSystemMessage.vue";
import ChatMarkdown from "./ChatMarkdown.vue";

export default {
  components: {
    ChatMarkdown,
    ChatSystemMessage,
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
    const collapsed = ref(false);
    let isComposition = false;

    const enableEditMode = (index, content) => {
      editedMessageIndex.value = index;
      editedMessageContent.value = content;
    };

    const updateMessage = (index, role) => {
      if (role === 'user' && editedMessageContent.value.trim()) {
        messageStore.messages[index].content = editedMessageContent.value;
        messageStore.messages[index].retryCount = 0;//重置
        messageStore.messages.splice(index + 1);
        messageStore.messageSearchDatabaseAndmessageInputAndChat(messageStore.messages, index + 1, true, true);
        cancelEdit();
      }
    };

    const cancelEdit = () => {
      editedMessageIndex.value = null;
      editedMessageContent.value = '';
    };

    const copyToClipboard = (content) => {
      navigator.clipboard.writeText(content).then(() => {
        message.success('内容已复制到剪切板');
      }).catch(() => {
        message.error('复制失败');
      });
    };

    const formatUserMessage = (content) => content.replace(/\n/g, '<br>');

    const messageContainsSQLdata = (content) => content.startsWith('执行结果:');
    const containsChartData = (content) => /```chart\n([\s\S]*?)```/.test(content);
    const containsCodeData = (content) => /```([\s\S]*?)/.test(content) || content.startsWith('执行sql出错:');

    const handleChartTypeSelect = (event, index) => {
      const chartType = event.key;
      messageStore.messageToChart(index, chartType);
    };

    const analyzeData = (index) => {
      const newMessages = [
        ...messageStore.messages.slice(0, index + 1),
        {role: 'user', content: `根据以上数据总结分析`}
      ];
      messageStore.messageInputAndChat(newMessages, index, false);
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

    const systemToggleCollapse = () => {
      collapsed.value = !collapsed.value;
    };

    const scrollToCurrentMessage = (index) => {
      nextTick(() => {
        const messageItems = messageList.value?.querySelectorAll('.message-item');
        messageItems[index].scrollIntoView({behavior: 'instant', block: 'end'});
      });
    };

    const isNonCopyableAssistant = (item) => {
      return item.role === 'assistant' && !props.debugMode && !messageContainsSQLdata(item.content);
    };

    const shouldRenderMarkdown = (item) => {
      return item.role === 'assistant' && (props.debugMode || !containsCodeData(item.content) || messageContainsSQLdata(item.content) || containsChartData(item.content));
    };

    onMounted(() => {
      scrollToCurrentMessage(messageStore.messages.length - 1);
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
      collapsed,
      updateMessage,
      cancelEdit,
      copyToClipboard,
      formatUserMessage,
      messageContainsSQLdata,
      containsCodeData,
      containsChartData,
      handleChartTypeSelect,
      systemToggleCollapse,
      handleKeyDown,
      handleComposition,
      messageStore,
      analyzeData,
      isNonCopyableAssistant,
      shouldRenderMarkdown,
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
  align-items: center;
  margin-bottom: 10px;
  overflow: hidden;
}

.role-icon {
  margin-right: 8px;
  font-size: large;
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
  display: flex;
  flex-direction: column;
}

.edit-textarea {
  margin-bottom: 8px;
}

.edit-actions {
  display: flex;
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
