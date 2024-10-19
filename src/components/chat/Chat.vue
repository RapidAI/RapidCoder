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
      <pane>
        <ssh-connector v-if="selectedSessionId" :selectedSessionId="selectedSessionId"/>
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
import SshConnector from '@/components/chat/SshConnector.vue'; // 引入新的组件

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
    const resize1 = (paneSize) => {
      parameterStore.sshPane = paneSize[0].size;
    };
    const resize2 = (paneSize) => {
      parameterStore.treePane = paneSize[0].size;
      parameterStore.filePane = paneSize[1].size;
      parameterStore.contentPane = paneSize[2].size;
    };
    return {
      parameterStore,
      resize1,
      resize2
    };
  },
};
</script>
