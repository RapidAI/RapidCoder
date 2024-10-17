<template>
  <div ref="terminal" style="width: 100%; height: 100%;"></div>
</template>

<script>
import { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { AttachAddon } from '@xterm/addon-attach';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { ImageAddon } from '@xterm/addon-image';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import 'xterm/css/xterm.css';

export default {
  props: {
    selectedSessionId: {
      required: true,
    },
  },
  mounted() {
    this.initTerminal();
  },
  methods: {
    initTerminal() {
      const terminal = new Terminal();
      terminal.open(this.$refs.terminal);
      terminal.write('SSH Terminal Initialized\r\n');

      // Load addons
      terminal.loadAddon(new WebLinksAddon());
      terminal.loadAddon(new AttachAddon(/* websocket instance */));
      terminal.loadAddon(new ClipboardAddon());
      terminal.loadAddon(new FitAddon());
      terminal.loadAddon(new ImageAddon());
      terminal.loadAddon(new SearchAddon());
      terminal.loadAddon(new SerializeAddon());
      terminal.loadAddon(new Unicode11Addon());
      terminal.loadAddon(new WebglAddon());

      // 这里可以添加SSH连接的逻辑
      // 例如：连接到远程服务器并处理输入输出
    },
  },
};
</script>
