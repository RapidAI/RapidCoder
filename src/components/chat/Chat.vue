<template>
  <a-layout class="custom-content">
    <chat-project :selectedSessionId="selectedSessionId"></chat-project>
    <chat-content :selectedSessionId="selectedSessionId"></chat-content>
  </a-layout>
</template>

<script>
import ChatProject from "./ChatProject.vue";
import ChatContent from "./ChatContent.vue";

export default {
  components: {
    ChatContent,
    ChatProject
  },
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  setup(props) {
  },
};
</script>

