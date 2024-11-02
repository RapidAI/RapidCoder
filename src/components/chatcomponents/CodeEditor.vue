<template>
  <div style="position: relative;height:100%;overflow:hidden">
    <button @click="undoEdit" style="position: absolute; top: 10px; right: 10px; z-index: 1000;">
      撤销
    </button>
    <Codemirror
        ref="cmRef"
        v-model="code"
        :extensions="extensions"
        @ready="handleReady"
    />
  </div>
</template>

<script>
import {defineComponent, ref, watch, onMounted, onBeforeUnmount} from 'vue'
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

    const saveFile = async () => {
      await ipcRenderer.invoke('saveFileContent', props.filePath, code.value);
    }

    const undoEdit = () => {
      if (cmRef.value && cmRef.value.view) {
        undo({state: cmRef.value.view.state, dispatch: cmRef.value.view.dispatch});
      }
    };

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleKeyDown);
    })

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeyDown);
    })

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
