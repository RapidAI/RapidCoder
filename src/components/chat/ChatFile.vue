<template>
  <a-tabs v-model:activeKey="currentSelectNode" size="small" type="editable-card" @edit="onEdit">
    <a-tab-pane v-for="session in currentSession.currentSelectNode" :key="session.sessionId" :tab="sessionTitle(session)"
                :closable="true">
      <chat-markdown :markdown="content" />
    </a-tab-pane>
  </a-tabs>
</template>

<script>
import CustomLoading from '@/components/common/CustomLoading.vue';
import {useSessionStore} from "@/store/SessionStore";
import ChatMarkdown from "@/components/chat/ChatMarkdown.vue";
import Chat from "@/components/chat/Chat.vue";
import {ref} from "vue";

const {ipcRenderer} = require('electron');

export default {
  props: {selectedSessionId: {required: true}},
  components: {Chat, ChatMarkdown, CustomLoading},
  setup(props) {

    const currentSelectNode = ref();
    const sessionStore = useSessionStore();

    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    return {
      currentSession,
      currentSelectNode,
    };
  }
};
</script>