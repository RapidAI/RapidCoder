<template>
  <div class="my-markdown">
    <div v-if="!chartData || debugMode" v-for="(block, index) in dataBlocks" :key="index">
      <!-- 代码块处理 -->
      <div v-if="block.isCode" class="code-header">
        <span>{{ block.language }}</span>
        <div class="code-actions">
          <a-tooltip v-if="block.language==='SQL'" placement="bottom">
            <template #title>
              <span>收藏到知识库</span>
            </template>
            <a @click="addToQueryVector(block.code)">
              <StarOutlined/>
            </a>
          </a-tooltip>
          <a-spin v-if="block.isLoading"/>
          <a-tooltip placement="bottom">
            <template #title>
              <span>复制代码</span>
            </template>
            <a @click="copyCode(block.code)">
              <CopyOutlined/>
            </a>
          </a-tooltip>
          <a-tooltip v-if="block.language==='SQL'" placement="bottom">
            <template #title>
              <span>再次运行</span>
            </template>
            <a @click="executeSQL()">
              <ClockCircleOutlined/>
            </a>
          </a-tooltip>
        </div>
      </div>
      <!-- 表格渲染 -->
      <a-table
          v-if="block.isTable"
          :columns="block.columns"
          :dataSource="block.currentData"
          :pagination="false"
          rowKey="key"/>
      <a-pagination
          v-if="block.isTable"
          :current="block.currentPage"
          :total="block.data.length"
          :pageSize="pageSize"
          :showSizeChanger="false"
          @change="(page) => changePage(index, page)"
          class="pagination-right"/>
      <!-- Markdown 渲染 -->
      <div v-else v-html="block.content" class="markdown-content"></div>
    </div>
    <!-- 图表渲染 -->
    <ChartRenderer v-if="chartData" :chartData="chartData" :chartOptions="chartOptions"/>
  </div>
</template>

<script>
import {ref, computed, onMounted, watch} from 'vue'
import {useMessageStore} from '@/store/MessageStoreWithBigData.js'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import ChartRenderer from './ChartRenderer.vue'
import {message, Pagination, Table, Spin} from 'ant-design-vue'
import {StarOutlined, CopyOutlined, ClockCircleOutlined} from '@ant-design/icons-vue'
import 'highlight.js/styles/github.css'
import {post} from '@/api/index.js'
import {useUserStore} from '@/store/UserStore.js'

export default {
  props: {
    markdown: {type: String, default: ''},
    debugMode: {type: Boolean, default: true},
    messagelistindex: {type: Number, default: 0},
  },
  components: {
    ChartRenderer,
    APagination: Pagination,
    ATable: Table,
    ASpin: Spin,
    StarOutlined,
    CopyOutlined,
    ClockCircleOutlined,
  },
  setup(props) {
    const userStore = useUserStore()
    const messageStore = useMessageStore()
    const dataBlocks = ref([])
    const pageSize = 10 // 每页显示的行数
    const md = new MarkdownIt({
      highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return `<pre class="hljs"><code class="language-${lang}">${hljs.highlight(str, {language: lang}).value}</code></pre>`
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
      },
    })

    // 编译后的 Markdown 内容
    const compiledMarkdown = computed(() => md.render(props.markdown))

    // 解析表格
    const parseTable = (tableHtml) => {
      const tableElement = document.createElement('div')
      tableElement.innerHTML = tableHtml

      const rows = Array.from(tableElement.querySelectorAll('tr'))
      const headerCells = rows[0].querySelectorAll('th, td')
      const columns = Array.from(headerCells).map((cell, index) => ({
        title: cell.textContent.trim(),
        dataIndex: `col${index}`,
        key: `col${index}`,
        align: 'center',
      }))

      const data = rows.slice(1).map((row, rowIndex) => {
        const cells = row.querySelectorAll('th, td')
        const rowData = {}
        cells.forEach((cell, cellIndex) => {
          rowData[`col${cellIndex}`] = cell.textContent.trim()
        })
        rowData.key = rowIndex
        return rowData
      })

      return {columns, data}
    }

    // 解析代码块
    const parseDataBlocks = () => {
      const tempBlocks = []
      const codeRegex = /<pre class="hljs"><code class="language-(.*?)">(.*?)<\/code><\/pre>/gs
      const tableRegex = /<table>([\s\S]*?)<\/table>/gs
      const matches = [...compiledMarkdown.value.matchAll(codeRegex)]
      const tableMatches = [...compiledMarkdown.value.matchAll(tableRegex)]
      let lastIndex = 0

      // 处理代码块
      matches.forEach((match) => {
        const [fullMatch, language, _] = match
        const index = match.index

        if (index > lastIndex) {
          tempBlocks.push({isCode: false, content: compiledMarkdown.value.slice(lastIndex, index)})
        }

        tempBlocks.push({isCode: true, language: language.toUpperCase(), code: props.markdown, content: fullMatch})
        lastIndex = index + fullMatch.length
      })

      // 处理表格
      tableMatches.forEach((match) => {
        const [fullMatch] = match
        const index = match.index

        if (index > lastIndex) {
          tempBlocks.push({isCode: false, content: compiledMarkdown.value.slice(lastIndex, index)})
        }

        const {columns, data} = parseTable(fullMatch)
        const totalPages = Math.ceil(data.length / pageSize)
        tempBlocks.push({
          isTable: true,
          columns: columns,
          data: data,
          currentPage: 1,
          totalPages: totalPages,
          currentData: data.slice(0, pageSize),
        })
        lastIndex = index + fullMatch.length
      })

      if (lastIndex < compiledMarkdown.value.length) {
        tempBlocks.push({isCode: false, content: compiledMarkdown.value.slice(lastIndex)})
      }

      dataBlocks.value = tempBlocks
    }

    onMounted(parseDataBlocks)
    watch(compiledMarkdown, parseDataBlocks)

    // 页码切换处理
    const changePage = (blockIndex, page) => {
      const block = dataBlocks.value[blockIndex]
      block.currentPage = page
      const start = (page - 1) * pageSize
      const end = page * pageSize
      block.currentData = block.data.slice(start, end)
    }

    // 解析图表数据
    const parseChartData = () => {
      const chartRegex = /```chart\n([\s\S]*?)```/
      const match = props.markdown.match(chartRegex)
      if (match) {
        try {
          return JSON.parse(match[1].trim())
        } catch (error) {
          console.error('图表数据解析失败:', error)
        }
      }
      return null
    }

    // 计算图表数据和选项
    const chartData = computed(() => parseChartData())
    const chartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {position: 'top'},
        title: {display: true, text: ''},
      },
    }))

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

    // 执行SQL代码
    const executeSQL = () => {
      messageStore.messageExecuteSQL(
          messageStore.messages[props.messagelistindex],
          messageStore.messages[props.messagelistindex - 1],
          props.messagelistindex
      )
    }

    const addToQueryVector = async (code) => {
      const block = dataBlocks.value.find((b) => b.code === code);
      if (block) block.isLoading = true;

      const matches = code.match(/```sql([\s\S]*?)```/);
      if (!matches) {
        message.error('不是标准sql');
        console.error(code);
        if (block) block.isLoading = false;
        return;
      }

      const sqlCode = matches[1].trim();
      const prompt = `${sqlCode}\n\n根据上面的sql信息仔细思考,推理出用户的查询指令\n返回json数据结构\n{\n   analysis: "...\n   queryinstruct: "...\n}`;

      const messages = [
        messageStore.messages[0],
        {role: 'user', content: prompt},
      ];

      const modelPayload = {...messageStore.currentModel, messages};
      const response = await post(`/chat/generatebyModel`, modelPayload);

      if (response.success) {
        const match = response.data.content.match(/```json([\s\S]*?)```/);
        const queryText = match ? JSON.parse(match[1].trim()).queryinstruct : "...";

        const data = {
          databaseInfoId: messageStore.session.databaseInfoId,
          sessionId: messageStore.session.sessionId,
          userId: userStore.userData.userId,
          queryText,
          resultText: sqlCode,
          success: true,
        };

        const res = await post('/queryVectors/add', data);

        res.success ? message.success('收藏成功') : message.error('收藏失败');
      } else {
        message.error(response.message);
        console.error(response);
      }

      if (block) block.isLoading = false;
    };

    return {
      dataBlocks,
      chartData,
      chartOptions,
      copyCode,
      executeSQL,
      addToQueryVector,
      changePage,
      pageSize,
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
