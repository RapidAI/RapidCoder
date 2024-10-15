<template>
  <div class="layout">
    <vue-draggable-resizable
        :w="siderWidth"
        :minw="200"
        :maxw="600"
        :axis="'x'"
        :drag-handle="'.drag-handle'"
        @resizing="onResizing"
        class="resizable-sider"
    >
      <div class="sider-content">
        <chat-tree v-if="selectedSessionId" :selectedSessionId="selectedSessionId"></chat-tree>
      </div>
      <div class="drag-handle"></div>
    </vue-draggable-resizable>

    <vue-draggable-resizable
        :x="siderWidth"
        :w="secondSiderWidth"
        :minw="200"
        :maxw="600"
        :axis="'x'"
        :drag-handle="'.second-drag-handle'"
        @resizing="onSecondResizing"
        class="resizable-sider"
    >
      <div class="sider-content">
        <chat-file v-if="selectedSessionId" :selectedSessionId="selectedSessionId"></chat-file>
      </div>
      <div class="second-drag-handle"></div>
    </vue-draggable-resizable>
  </div>
</template>

<script>
import {ref} from 'vue';
import VueDraggableResizable from 'vue-draggable-resizable';
import ChatTree from "@/components/chatcomponents/ChatTree.vue";
import ChatFile from "@/components/chatcomponents/ChatFile.vue";

export default {
  components: {
    ChatFile,
    ChatTree,
    VueDraggableResizable,
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
    const siderWidth = ref(300);
    const secondSiderWidth = ref(300);

    const onResizing = (x, y, width) => {
      siderWidth.value = width;
    };

    const onSecondResizing = (x, y, width) => {
      secondSiderWidth.value = width;
    };

    return {
      siderWidth,
      secondSiderWidth,
      onResizing,
      onSecondResizing,
    };
  },
};
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
}

.resizable-sider {
  position: relative;
}

.sider-content {
  height: 100%;
  overflow: auto;
  background-color: #fff;
}

.drag-handle,
.second-drag-handle {
  width: 5px;
  cursor: ew-resize;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
}
</style>
