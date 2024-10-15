<template>
  <a-layout class="custom-content">
    <splitpanes class="default-theme" @resize="resize">
      <pane :size="styleStore.treePane">
        <chat-tree v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane :size="styleStore.filePane">
        <chat-file v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane :size="styleStore.contentPane">
        <chat-content v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
    </splitpanes>
  </a-layout>
</template>

<script>
import {Splitpanes, Pane} from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import {useStyleStore} from '@/store/StyleStore';
import ChatTree from '@/components/chatcomponents/ChatTree.vue';
import ChatFile from '@/components/chatcomponents/ChatFile.vue';
import ChatContent from '@/components/chat/ChatContent.vue';

export default {
  components: {
    ChatTree,
    ChatFile,
    ChatContent,
    Splitpanes,
    Pane,
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup() {
    const styleStore = useStyleStore();
    const resize = (paneSize) => {
      styleStore.treePane = paneSize[0].size;
      styleStore.filePane = paneSize[1].size;
      styleStore.contentPane = paneSize[2].size;
    };
    return {
      styleStore,
      resize
    };
  },
};
</script>
