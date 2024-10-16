<template>
  <div class="markdown-content">
    <div v-for="(block, index) in dataBlocks" :key="index">
      <div v-if="block.isCode">
        <div class="code-header">
          <span>{{ block.language }}</span>
          <div class="code-actions">
            <a-button type="primary" size="small" @click="copyCode(block.code)">复制</a-button>
            <a-button type="primary" size="small" @click="executeCode(block)">替换</a-button>
          </div>
        </div>
      </div>
      <div v-html="block.content"></div>
    </div>
  </div>
</template>

<script>
const {ipcRenderer} = require('electron');
import {ref, watch} from 'vue';
import {useSessionStore} from '@/store/SessionStore.js';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import {message} from 'ant-design-vue';

export default {
  props: {
    markdown: String,
    messageIndex: Number,
  },
  setup(props) {
    const sessionStore = useSessionStore();
    const dataBlocks = ref([]);

    const md = new MarkdownIt({
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(str, {language: lang}).value;
        }
        return hljs.highlightAuto(str).value;
      },
    });

    const parseDataBlocks = () => {
      const tokens = md.parse(props.markdown || '', {});
      const tempBlocks = [];
      let currentTokens = [];

      tokens.forEach(token => {
        if (token.type === 'fence') {
          if (currentTokens.length) {
            tempBlocks.push({
              isCode: false,
              content: md.renderer.render(currentTokens, md.options),
            });
            currentTokens = [];
          }
          tempBlocks.push({
            isCode: true,
            language: token.info.trim() || 'plaintext',
            code: token.content,
            content: md.renderer.render([token], md.options),
          });
        } else {
          currentTokens.push(token);
        }
      });

      if (currentTokens.length) {
        tempBlocks.push({
          isCode: false,
          content: md.renderer.render(currentTokens, md.options),
        });
      }

      dataBlocks.value = tempBlocks;
    };

    watch(() => props.markdown, parseDataBlocks, {immediate: true});

    const copyCode = async (code) => {
      try {
        await navigator.clipboard.writeText(code);
        message.success('内容已复制到剪切板');
      } catch (err) {
        console.error('复制失败', err);
      }
    };

    const executeCode = async (block) => {
      const [language, filePath] = block.language.split(':');

      if (!filePath) {
        console.error('Invalid language format:', block.language);
        return;
      }

      await ipcRenderer.invoke('replaceFileContent', filePath, block.code);
      message.info(`文件 ${filePath} 替换成功。`);
    };

    return {
      dataBlocks,
      copyCode,
      executeCode,
    };
  },
};
</script>
<style lang="scss">
@import "@/assets/chatmarkdown.css";
</style>
