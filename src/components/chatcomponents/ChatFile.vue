<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit" hideAdd>
    <a-tab-pane v-for="(file, index) in currentSession.currentSelectFile" :key="file" :tab="getTitle(file)" :closable="true">
      <div class="chat-file" v-html="fileContent[index]"></div>
    </a-tab-pane>
  </a-tabs>
</template>

<script>
import {useSessionStore} from "@/store/SessionStore";
import {ref, computed, watch} from "vue";
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const {ipcRenderer} = require('electron');

// 初始化MarkdownIt
const md = new MarkdownIt({
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(str, {language: lang}).value;
    }
    return hljs.highlightAuto(str).value;
  },
});

export default {
  props: {selectedSessionId: {required: true}},
  setup({selectedSessionId}) {
    const fileContent = ref([]);
    const activeFile = ref(null);
    const sessionStore = useSessionStore();

    const currentSession = computed(() => sessionStore.sessions.find(s => s.sessionId === selectedSessionId) || {});

    const getTitle = filePath => filePath.split('/').pop();
    const getLanguageFromPath = filePath => filePath.split('.').pop();

    const wrapFileContent = (content, filePath) => {
      const language = getLanguageFromPath(filePath);
      return `\`\`\`${language}:${filePath}\n${content}\n\`\`\``;
    };

    watch(() => currentSession.value?.currentSelectFile, async (newFiles) => {
      if (newFiles?.length) {
        fileContent.value = await Promise.all(newFiles.map(async (file) => {
          const content = await ipcRenderer.invoke('getFileContent', file);
          return md.render(wrapFileContent(content, file));
        }));
        activeFile.value = newFiles[0];
      }
    }, {immediate: true});

    const onEdit = (targetKey, action) => {
      if (action === 'remove') {
        const index = currentSession.value.currentSelectFile.indexOf(targetKey);
        if (index !== -1) {
          currentSession.value.currentSelectFile.splice(index, 1);
          fileContent.value.splice(index, 1);
          activeFile.value = currentSession.value.currentSelectFile[0] || null;
        }
      }
    };

    return {
      currentSession,
      fileContent,
      getTitle,
      onEdit,
      activeFile,
    };
  },
};
</script>
<style>
.chat-file {
  height: 89vh;
  overflow: auto;
}
</style>
