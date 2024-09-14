<template>
  <div class="my-markdown">
    <div v-if="debugMode" v-for="(block, index) in dataBlocks" :key="index">
      <!-- 代码块处理 -->
      <div v-if="block.isCode" class="code-header">
        <span>{{ block.language }}</span>
        <div class="code-actions">
          <a-spin v-if="block.isLoading"/>
          <a-tooltip placement="bottom">
            <template #title>
              <span>复制代码</span>
            </template>
            <a @click="copyCode(block.code)">
              <CopyOutlined/>
            </a>
          </a-tooltip>
          <a-tooltip placement="bottom">
            <template #title>
              <span>再次运行</span>
            </template>
            <a @click="executeCode()">
              <ClockCircleOutlined/>
            </a>
          </a-tooltip>
        </div>
      </div>
      <div v-html="block.content" class="markdown-content"></div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useMessageStore } from '@/store/MessageStore.js';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { message, Spin } from 'ant-design-vue';
import { StarOutlined, CopyOutlined, ClockCircleOutlined } from '@ant-design/icons-vue';


export default {
  props: {
    markdown: {type: String, default: ''},
    debugMode: {type: Boolean, default: true},
    messagelistindex: {type: Number, default: 0},
  },
  components: {
    ASpin: Spin,
    StarOutlined,
    CopyOutlined,
    ClockCircleOutlined,
  },
  setup(props) {
    const messageStore = useMessageStore();
    const dataBlocks = ref([]);
    const md = new MarkdownIt({
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`;
        }
        if (!lang) {
          const autoLangResult = hljs.highlightAuto(str);
          return `<pre class="hljs"><code class="language-${autoLangResult.language}">${autoLangResult.value}</code></pre>`;
        }
        lang='html'
        return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      },
    });

    // 编译后的 Markdown 内容
    const compiledMarkdown = computed(() => md.render(props.markdown))

    // 解析代码块
    // 解析代码块
    const parseDataBlocks = () => {
      const tempBlocks = []
      const codeRegex = /<pre class="hljs"><code class="language-(.*?)">(.*?)<\/code><\/pre>/gs
      const matches = [...compiledMarkdown.value.matchAll(codeRegex)]
      let lastIndex = 0

      // 处理代码块
      matches.forEach((match) => {
        const [fullMatch, language, _] = match
        const index = match.index

        if (index > lastIndex) {
          tempBlocks.push({isCode: false, content: compiledMarkdown.value.slice(lastIndex, index)})
        }

        // 如果没有语言信息，则默认设置为 'plaintext' 或调用 highlight.js 自动检测
        const detectedLanguage = language || hljs.highlightAuto(match[2]).language || 'plaintext';

        tempBlocks.push({isCode: true, language: detectedLanguage.toUpperCase(), code: match[2], content: fullMatch})
        lastIndex = index + fullMatch.length
      })

      if (lastIndex < compiledMarkdown.value.length) {
        tempBlocks.push({isCode: false, content: compiledMarkdown.value.slice(lastIndex)})
      }

      dataBlocks.value = tempBlocks
    }


    onMounted(parseDataBlocks)
    watch(compiledMarkdown, parseDataBlocks)

    // 复制代码到剪切板
    const copyCode = (code) => {
      navigator.clipboard
          .writeText(code)
          .then(() => {
            message.success('内容已复制到剪切板')
          })
          .catch((err) => {
            console.error('复制失败', err)
          })
    }

    // 执行Code代码
    const executeCode = () => {
      messageStore.messageExecuteCode(
          messageStore.currentSession.messages[props.messagelistindex],
          messageStore.currentSession.messages[props.messagelistindex - 1],
          props.messagelistindex
      )
    }

    return {
      dataBlocks,
      copyCode,
      executeCode,
    }
  },
}
</script>

<style>
.my-markdown {
  width: 100%;
  overflow: auto;
}

.markdown-content {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  color: #333;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4,
.markdown-content h5,
.markdown-content h6 {
  font-weight: bold;
  margin-top: 20px;
  margin-bottom: 10px;
}

.markdown-content p {
  margin: 10px 0;
}

.markdown-content a {
  color: #1e90ff;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.markdown-content ul,
.markdown-content ol {
  margin: 10px 0 10px 20px;
}

.markdown-content blockquote {
  margin: 10px 0;
  padding: 10px 20px;
  background-color: #f9f9f9;
  border-left: 5px solid #ccc;
}

.markdown-content pre {
  background: #f8f8f8;
  padding: 10px;
  border-radius: 5px;
  overflow-x: auto; /* 允许水平滚动 */
  margin-top: 0;
  padding-top: 0;
  white-space: pre-wrap; /* 保留空白字符并换行 */
  word-wrap: break-word; /* 长单词或 URL 换行 */
}

.markdown-content code {
  background: #f8f8f8;
  padding: 2px 4px;
  border-radius: 3px;
  white-space: pre-wrap; /* 保留空白字符并换行 */
  word-wrap: break-word; /* 长单词或 URL 换行 */
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f0f0f0;
  padding: 5px 10px;
  border-radius: 5px 5px 0 0;
}

.code-actions {
  display: flex;
  gap: 10px;
  color: #005fff;
}

.pagination-right {
  display: flex;
  margin-top: 20px;
  justify-content: right;
}
</style>