<template>
  <a-layout class="custom-content">
    <splitpanes class="default-theme">
      <pane >
        <chat-tree v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane>
        <chat-file v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane>
        <chat-content v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
    </splitpanes>
  </a-layout>
</template>

<script>
import {Splitpanes, Pane} from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import ChatTree from '@/components/chatcomponents/ChatTree.vue';
import ChatFile from '@/components/chatcomponents/ChatFile.vue';
import ChatContent from '@/components/chat/ChatContent.vue';

export default {
  components: {
    ChatTree,
    ChatFile,
    ChatContent,
    Splitpanes,
    Pane
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
};
</script>
