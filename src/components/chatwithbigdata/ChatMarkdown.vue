<template>
  <div class="my-markdown">
    <div v-if="debugMode" v-for="(block, index) in dataBlocks" :key="index">
      <div v-if="block.isCode" class="code-header">
        <span>{{ block.language }}</span>
        <div class="code-actions">
          <custom-loading v-if="block.isLoading" />
          <a-tooltip placement="bottom" title="复制代码">
            <a @click="copyCode(block.code)">
              <CopyOutlined />
            </a>
          </a-tooltip>
          <a-tooltip placement="bottom" title="再次运行">
            <a @click="executeCode()">
              <ClockCircleOutlined />
            </a>
          </a-tooltip>
        </div>
      </div>
      <div v-html="block.content"></div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';
import { useMessageStore } from '@/store/MessageStore.js';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { message } from 'ant-design-vue';
import { CopyOutlined, ClockCircleOutlined } from '@ant-design/icons-vue';
import CustomLoading from "@/components/common/CustomLoading.vue";
export default {
  props: {
    markdown: { type: String, default: '' },
    debugMode: { type: Boolean, default: true },
    messageindex: { type: Number, default: 0 },
  },
  components: {
    CopyOutlined,
    CustomLoading,
    ClockCircleOutlined,
  },
  setup(props) {
    const messageStore = useMessageStore();
    const dataBlocks = ref([]);

    const md = new MarkdownIt({
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(str, { language: lang }).value;
        }
        return hljs.highlightAuto(str).value;
      },
    });

    const parseDataBlocks = () => {
      const tempBlocks = [];
      const tokens = md.parse(props.markdown, {});
      let index = 0;

      while (index < tokens.length) {
        const token = tokens[index];
        if (token.type === 'fence') {
          const language = token.info.trim().toUpperCase() || 'PLAINTEXT';
          tempBlocks.push({
            isCode: true,
            language,
            code: token.content,
            content: md.renderer.render([token], md.options),
          });
          index++;
        } else {
          const nonCodeTokens = [];
          while (index < tokens.length && tokens[index].type !== 'fence') {
            nonCodeTokens.push(tokens[index]);
            index++;
          }
          if (nonCodeTokens.length > 0) {
            tempBlocks.push({
              isCode: false,
              content: md.renderer.render(nonCodeTokens, md.options),
            });
          }
        }
      }

      dataBlocks.value = tempBlocks;
    };

    watch(() => props.markdown, parseDataBlocks, { immediate: true });

    const copyCode = (code) => {
      navigator.clipboard
          .writeText(code)
          .then(() => message.success('内容已复制到剪切板'))
          .catch((err) => console.error('复制失败', err));
    };

    const executeCode = () => {
      const { messages } = messageStore.currentSession;
      messageStore.messageExecuteCode(props.messageindex);
    };

    return {
      dataBlocks,
      copyCode,
      executeCode,
    };
  },
};
</script>

<style>
.my-markdown {
  width: 100%;
  overflow: auto;
  white-space: normal;
  word-wrap: break-word;
  padding-right: 3vh;
}


.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  border-radius: 5px 5px 0 0;
}

.code-actions {
  display: flex;
  gap: 10px;
  color: #d4d4d4;
  margin-right: 25px;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 10px;
  margin: 0;
  border-radius: 0 0 5px 5px;
  overflow-x: auto;
}

code {
  background-color: transparent;
  color: inherit;
}

/* VSCode Dark Theme Syntax Highlighting */
.hljs-comment,
.hljs-quote {
  color: #6a9955;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #c586c0;
}

.hljs-number,
.hljs-literal,
.hljs-variable,
.hljs-template-variable,
.hljs-tag .hljs-attr {
  color: #b5cea8;
}

.hljs-string,
.hljs-doctag {
  color: #ce9178;
}

.hljs-title,
.hljs-section,
.hljs-selector-id {
  color: #569cd6;
}

.hljs-subst {
  color: #d4d4d4;
}

.hljs-type,
.hljs-class .hljs-title {
  color: #4ec9b0;
}

.hljs-tag,
.hljs-name,
.hljs-attribute {
  color: #d7ba7d;
}

.hljs-regexp,
.hljs-link {
  color: #d16969;
}

.hljs-symbol,
.hljs-bullet {
  color: #569cd6;
}

.hljs-built_in,
.hljs-builtin-name {
  color: #dcdcaa;
}

.hljs-meta {
  color: #9cdcfe;
}

.hljs-deletion {
  background: #ff0000;
}

.hljs-addition {
  background: #00ff00;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}
</style>
