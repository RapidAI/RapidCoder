<template>
  <div ref="terminal" style="width: 100%; height: 100%;"></div>
</template>

<script>
import {Terminal} from '@xterm/xterm';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {AttachAddon} from '@xterm/addon-attach';
import {ClipboardAddon} from '@xterm/addon-clipboard';
import {FitAddon} from '@xterm/addon-fit';
import {ImageAddon} from '@xterm/addon-image';
import {SearchAddon} from '@xterm/addon-search';
import {SerializeAddon} from '@xterm/addon-serialize';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import {WebglAddon} from '@xterm/addon-webgl';
import 'xterm/css/xterm.css';

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  mounted() {
    this.initTerminal();
    window.addEventListener('resize', this.onResize);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.terminal) {
      this.terminal.dispose();
    }
  },
  methods: {
    initTerminal() {
      // 保存 terminal 到 this
      this.terminal = new Terminal({allowProposedApi: true});
      this.terminal.open(this.$refs.terminal);
      this.terminal.write('SSH Terminal Initialized\r\n');

      // 加载所有的插件
      const fitAddon = new FitAddon();
      this.terminal.loadAddon(fitAddon);
      this.terminal.loadAddon(new WebLinksAddon());
      this.terminal.loadAddon(new ClipboardAddon());
      this.terminal.loadAddon(new ImageAddon());
      this.terminal.loadAddon(new SearchAddon());
      this.terminal.loadAddon(new SerializeAddon());
      this.terminal.loadAddon(new Unicode11Addon());
      this.terminal.loadAddon(new WebglAddon());

      // 适应初始窗口大小
      fitAddon.fit();
    },
    onResize() {
      const fitAddon = this.terminal.getAddon('fit');
      if (fitAddon) {
        fitAddon.fit();
      }
    },
  },
};
</script>
