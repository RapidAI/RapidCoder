<template>
  <a-layout class="custom-content">
    <splitpanes class="default-theme" :push-other-panes="false" @resize="resize1" horizontal>
      <pane :size="parameterStore.sshPane">
        <splitpanes class="default-theme" :push-other-panes="false" @resize="resize2">
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
      </pane>
<!--      <pane>-->
<!--        <ssh-connector v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>-->
<!--      </pane>-->
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
import SshConnector from '@/components/chat/Terminal.vue'; // 引入新的组件

export default {
  components: {
    ChatTree,
    ChatFileEditor,
    ChatContainer,
    SshConnector, // 注册新的组件
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
const updatePaneSize = (paneSize, paneKey) => {
  parameterStore[paneKey] = paneSize[0].size;
};
const resize1 = (paneSize) => updatePaneSize(paneSize, 'sshPane');
const resize2 = (paneSize) => {
  updatePaneSize(paneSize.slice(0, 1), 'treePane');
  updatePaneSize(paneSize.slice(1, 2), 'filePane');
  updatePaneSize(paneSize.slice(2, 3), 'contentPane');
};
    return {
      parameterStore,
      resize1,
      resize2
    };
  },
};
</script>
