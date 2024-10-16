<template>
  <Codemirror
      v-model="code"
      :extensions="extensions"
      :style="{ height: '89vh' }"
  />
</template>

<script>
import {defineComponent, ref, watch, onMounted, onBeforeUnmount} from 'vue'
import {Codemirror} from 'vue-codemirror'
import {oneDark} from '@codemirror/theme-one-dark'
const {ipcRenderer} = require('electron');

// 导入所有语言扩展
import {javascript} from '@codemirror/lang-javascript'
import {html} from '@codemirror/lang-html'
import {css} from '@codemirror/lang-css'
import {markdown} from '@codemirror/lang-markdown'
import {python} from '@codemirror/lang-python'
import {sql} from '@codemirror/lang-sql'
import {yaml} from '@codemirror/lang-yaml'
import {xml} from '@codemirror/lang-xml'
import {go} from '@codemirror/lang-go'
import {json} from '@codemirror/lang-json'
import {php} from '@codemirror/lang-php'
import {cpp} from '@codemirror/lang-cpp'
import {rust} from '@codemirror/lang-rust'
import {vue} from '@codemirror/lang-vue'
import {sass} from '@codemirror/lang-sass'
import {less} from '@codemirror/lang-less'
import {angular} from '@codemirror/lang-angular'
import {liquid} from '@codemirror/lang-liquid'
import {wast} from '@codemirror/lang-wast'
import {java} from '@codemirror/lang-java'

// 引入 indentMore 来支持代码缩进
import {indentMore} from '@codemirror/commands'

export default defineComponent({
  components: {
    Codemirror
  },
  props: {
    content: {
      type: String,
      required: true
    },
    language: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const code = ref(props.content)

    // 根据文件扩展名或语言名称确定语言
    const getLanguageExtension = (lang) => {
      switch (lang.toLowerCase()) {
        case 'javascript':
        case 'js':
          return javascript()
        case 'html':
          return html()
        case 'java':
          return java()
        case 'css':
          return css()
        case 'markdown':
        case 'md':
          return markdown()
        case 'python':
        case 'py':
          return python()
        case 'sql':
          return sql()
        case 'yaml':
        case 'yml':
          return yaml()
        case 'xml':
          return xml()
        case 'go':
          return go()
        case 'json':
          return json()
        case 'php':
          return php()
        case 'cpp':
        case 'c++':
          return cpp()
        case 'rust':
          return rust()
        case 'vue':
          return vue()
        case 'sass':
          return sass()
        case 'less':
          return less()
        case 'angular':
          return angular()
        case 'liquid':
          return liquid()
        case 'wast':
          return wast()
        default:
          return []
      }
    }

    const extensions = ref([getLanguageExtension(props.language), oneDark])

    // 监听 props.content 的变化
    watch(() => props.content, (newContent) => {
      code.value = newContent
    })

    // 监听 props.language 的变化并更新扩展
    watch(() => props.language, (newLanguage) => {
      extensions.value = [getLanguageExtension(newLanguage), oneDark]
    })

    // 保存文件方法
    const saveFile = async () => {
      await ipcRenderer.invoke('replaceFileContent', props.filePath, code.value);
    }

    // 键盘事件监听，用于保存和代码对齐快捷键
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();  // 阻止默认保存行为
        saveFile();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();  // 阻止默认行为
        // 触发代码对齐（缩进）
        indentMore(code.value);
      }
    }

    // 组件挂载时添加键盘监听器
    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown);
    })

    // 组件卸载时移除键盘监听器
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeyDown);
    })

    return {
      code,
      extensions,
    }
  }
})
</script>
