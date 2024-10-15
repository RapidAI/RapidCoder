<template>
  <a-tabs v-model:activeKey="activeFile" size="small" type="editable-card" @edit="onEdit" hideAdd>
    <a-tab-pane v-for="(file, index) in currentSession.currentSelectFile" :key="file" :tab="getTitle(file)"
                :closable="true">
      <div class="chat-file" v-html="fileContentMarkdown[index]"></div>
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
  setup(props) {
    const fileContentMarkdown = ref([]);
    const fileContent = ref([]);
    const activeFile = ref(null);
    const sessionStore = useSessionStore();

    const currentSession = computed(() => sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || {});

    const getTitle = filePath => filePath.split('/').pop();

    const wrapFileContent = (content, filePath) => {
      const language = filePath.split('.').pop();
      return `${filePath}\n\`\`\`${language}\n${content}\n\`\`\``;
    };


    watch(() => currentSession.value?.currentSelectFile, async (newFiles) => {
      if (newFiles?.length) {
        fileContent.value = await Promise.all(newFiles.map(file => ipcRenderer.invoke('getFileContent', file).then(content => wrapFileContent(content, file))));
        fileContentMarkdown.value = fileContent.value.map(content => md.render(content));
        if (!newFiles.includes(activeFile.value)) {
          activeFile.value = newFiles[0];
        }
        // 跟message的system互动
        currentSession.value.messages[0] = {
          role: 'system',
          content: fileContent.value.join('\n')
        };
      }else{
        // 空
        currentSession.value.messages[0] = {
          role: 'system',
          content: ""
        };
      }
    }, {immediate: true});


    const onEdit = (targetKey, action) => {
      if (action === 'remove') {
        const index = currentSession.value.currentSelectFile.indexOf(targetKey);
        if (index !== -1) {
          // 使用新的数组引用
          currentSession.value.currentSelectFile = [
            ...currentSession.value.currentSelectFile.slice(0, index),
            ...currentSession.value.currentSelectFile.slice(index + 1)
          ];
        }
      }
    };


    return {
      currentSession,
      fileContentMarkdown,
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
