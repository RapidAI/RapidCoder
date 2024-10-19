<template>
  <div ref="terminal" style="width: 100%; height: 100%;"></div>
</template>

<script>
import {Terminal} from 'xterm';
import {WebLinksAddon} from '@xterm/addon-web-links';
import {FitAddon} from '@xterm/addon-fit';
import {ClipboardAddon} from '@xterm/addon-clipboard';
import {ImageAddon} from '@xterm/addon-image';
import {SearchAddon} from '@xterm/addon-search';
import {SerializeAddon} from '@xterm/addon-serialize';
import {Unicode11Addon} from '@xterm/addon-unicode11';
import 'xterm/css/xterm.css';

const {ipcRenderer} = require('electron');

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  mounted() {
    this.initTerminal();
    window.addEventListener('resize', this.onResize);

    // 启动 Shell 会话
    ipcRenderer.invoke('start-shell').then((response) => {
      this.terminal.write(response.message + '\r\n');
    });

    // 监听 Shell 输出并显示到终端
    ipcRenderer.on('shell-output', (event, output) => {
      this.terminal.write(output);
    });
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.terminal) {
      this.terminal.dispose();
    }
    // 停止 Shell 会话
    ipcRenderer.invoke('stop-shell');
    ipcRenderer.removeAllListeners('shell-output');
  },
  methods: {
    initTerminal() {
      // 保存 terminal 到 this
      this.terminal = new Terminal({allowProposedApi: true});
      this.terminal.open(this.$refs.terminal);
      this.terminal.write('Shell Terminal Initialized\r\n');

      // 加载所有的插件
      const fitAddon = new FitAddon();
      this.terminal.loadAddon(fitAddon);
      this.terminal.loadAddon(new WebLinksAddon());
      this.terminal.loadAddon(new ClipboardAddon());
      this.terminal.loadAddon(new ImageAddon());
      this.terminal.loadAddon(new SearchAddon());
      this.terminal.loadAddon(new SerializeAddon());
      this.terminal.loadAddon(new Unicode11Addon());

      // 适应初始窗口大小
      fitAddon.fit();

      // 监听用户输入并发送到 Shell
      this.terminal.onData((data) => {
        ipcRenderer.invoke('send-shell-command', data);
      });
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
