<template>
  <div class="markdown-content">
    <div v-for="(block, index) in dataBlocks" :key="index" style="margin-bottom: 10px;">

      <div v-if="block.isCode">
        <div class="code-header">
          <span>{{ block.language + (block.filePath ? ':' + block.filePath.split(/[\/]/).pop() : '') }}</span>
          <div class="code-actions">
            <a-button type="default" size="small" @click="copyCode(block.code)">复制</a-button>
            <a-button type="default" size="small" @click="executeCode(block)">应用</a-button>
          </div>
        </div>
      </div>

      <div v-html="block.content"></div>

      <div v-if="block.isCode">
        <div class="code-footer">
          <div class="code-actions">
            <a-button type="default" size="small" @click="copyCode(block.code)">复制</a-button>
            <a-button type="default" size="small" @click="executeCode(block)">应用</a-button>
          </div>
        </div>
      </div>

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
import {saveFileContent} from '@/util/chat.js';

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
          const infoParts = token.info.trim().split(':');
          const language = infoParts[0];
          const filePath = infoParts.slice(1).join(':');
          tempBlocks.push({
            isCode: true,
            language: language || 'plaintext',
            filePath: filePath || '',
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
      const filePath = block.filePath;
      const code = block.code;

      if (!filePath || !code) {
        message.info(`文件路径或内容不存在`);
        return;
      }

      await saveFileContent(filePath, code);
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
