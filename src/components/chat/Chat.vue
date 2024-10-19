<template>
  <a-layout class="custom-content">
    <splitpanes class="default-theme" :push-other-panes="false" @resize="resize">
      <pane :size="parameterStore.treePane">
        <chat-tree v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane :size="parameterStore.filePane">
        <chat-file-editor v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
      <pane :size="parameterStore.contentPane">
        <chat-container v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
      </pane>
    </splitpanes>
  </a-layout>
</template>

<script>
import {Splitpanes, Pane} from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import {useParameterStore} from '@/store/ParameterStore';
import ChatTree from '@/components/chat/ChatTree.vue';
import ChatFileEditor from '@/components/chat/ChatEditor.vue';
import ChatContainer from '@/components/chat/ChatContainer.vue';

export default {
  components: {
    ChatTree,
    ChatFileEditor,
    ChatContainer,
    Splitpanes,
    Pane,
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup() {
    const parameterStore = useParameterStore();
    const resize = (paneSize) => {
      parameterStore.treePane = paneSize[0].size;
      parameterStore.filePane = paneSize[1].size;
      parameterStore.contentPane = paneSize[2].size;
    };
    return {
      parameterStore,
      resize,
    };
  },
};
</script>
