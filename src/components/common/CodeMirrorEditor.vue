<template>
  <Codemirror
      v-model="code"
      :extensions="extensions"
      :style="{ height: '89vh' }"
      @ready="handleReady"
  />
</template>

<script>
import {defineComponent, ref, watch} from 'vue'
import {Codemirror} from 'vue-codemirror'
import {oneDark} from '@codemirror/theme-one-dark'

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

    // 根据内容自动检测语言
    const detectLanguageFromContent = (content) => {
      if (/^\s*</.test(content)) {
        return 'html'
      } else if (/^import .* from ['"]|function|const|let|var/.test(content)) {
        return 'javascript'
      } else if (/^\s*<template>/.test(content)) {
        return 'vue'
      } else if (/^\s*def /.test(content)) {
        return 'python'
      } else if (/^interface |^type /.test(content)) {
        return 'typescript'
      } else if (/^package |^func /.test(content)) {
        return 'go'
      } else if (/^\s*#include|int main\(/.test(content)) {
        return 'cpp'
      } else if (/^<\?php|echo /.test(content)) {
        return 'php'
      } else if (/^\s*class |def /.test(content)) {
        return 'ruby'
      } else if (/^# |^[-*] /.test(content)) {
        return 'markdown'
      } else {
        return 'javascript'  // 默认使用 JavaScript
      }
    }

    const extensions = ref([getLanguageExtension(props.language), oneDark])

    // 监听 props.content 的变化并自动检测语言
    watch(() => props.content, (newContent) => {
      code.value = newContent

      // 自动检测语言并更新扩展
      const detectedLanguage = detectLanguageFromContent(newContent)
      if (detectedLanguage !== props.language.toLowerCase()) {
        extensions.value = [getLanguageExtension(detectedLanguage), oneDark]
      }
    })

    // 监听 props.language 的变化并更新扩展
    watch(() => props.language, (newLanguage) => {
      extensions.value = [getLanguageExtension(newLanguage), oneDark]
    })

    const handleReady = (payload) => {
      console.log('Codemirror is ready', payload.view)
    }

    return {
      code,
      extensions,
      handleReady
    }
  }
})
</script>
