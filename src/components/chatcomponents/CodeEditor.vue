<template>
  <a-button type="default" size="small" style="position:sticky; top: 0; right:0; z-index: 1000;" @click="undoEdit">撤销</a-button>
  <Codemirror
    ref="cmRef"
    v-model="code"
    :extensions="extensions"
    @ready="handleReady"
  />
</template>

<script>
import {defineComponent, ref, watch, onMounted} from 'vue'
import {Codemirror} from 'vue-codemirror'
import {oneDark} from '@codemirror/theme-one-dark'
import {materialLight} from '@ddietr/codemirror-themes/material-light'
import {materialDark} from '@ddietr/codemirror-themes/material-dark'
import {solarizedLight} from '@ddietr/codemirror-themes/solarized-light'
import {solarizedDark} from '@ddietr/codemirror-themes/solarized-dark'
import {dracula as theme} from '@ddietr/codemirror-themes/dracula'
import {githubLight} from '@ddietr/codemirror-themes/github-light'
import {githubDark} from '@ddietr/codemirror-themes/github-dark'
import {aura} from '@ddietr/codemirror-themes/aura'
import {tokyoNight} from '@ddietr/codemirror-themes/tokyo-night'
import {tokyoNightStorm} from '@ddietr/codemirror-themes/tokyo-night-storm'
import {tokyoNightDay} from '@ddietr/codemirror-themes/tokyo-night-day'
import {undo} from '@codemirror/commands'
import {debounce} from 'lodash' // 引入 lodash 的 debounce

const {ipcRenderer} = require('electron');

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
    },
    selectedSessionId: {
      required: true
    },
  },
  setup(props) {
    const code = ref(props.content)
    const cmRef = ref({view: null})

    const handleReady = ({view}) => {
      cmRef.value.view = view
    }

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

    const extensions = ref([getLanguageExtension(props.language), theme])

    watch(() => props.content, (newContent) => {
      code.value = newContent
    })

    watch(() => props.language, (newLanguage) => {
      extensions.value = [getLanguageExtension(newLanguage), theme]
    })

    // 使用 debounce 进行自动保存，间隔设置为 500ms
    const debouncedSaveFile = debounce(async () => {
      await ipcRenderer.invoke('saveFileContent', props.filePath, code.value);
    }, 500);

    watch(() => code.value, () => {
      debouncedSaveFile();
    })

    const undoEdit = () => {
      if (cmRef.value && cmRef.value.view) {
        undo({state: cmRef.value.view.state, dispatch: cmRef.value.view.dispatch});
      }
    };

    return {
      code,
      handleReady,
      extensions,
      undoEdit,
      cmRef
    }
  }
})
</script>

<style scoped>
:deep(.cm-searching ){
  background-color: white !important;
  color: black;
}
:deep(.cm-selectionMatch) {
  background-color: #757474 !important;
  color: black;
}
</style>
