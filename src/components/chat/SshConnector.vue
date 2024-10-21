<template>
  <terminal
      :name="name"
      @exec-cmd="onExecCmd"
      :show-header="false"
      :commandStore="cmdStore"
      @on-keydown="onKeydown"
  />
</template>

<script>
import { Terminal, TerminalApi } from "vue-web-terminal";
import "vue-web-terminal/lib/theme/dark.css";

const { ipcRenderer } = require("electron");

export default {
  components: { Terminal },
  data() {
    return {
      name: "my-terminal",
      cmdStore: [
        // 此处省略命令列表以节省篇幅
      ],
      currentDirectory: process.cwd(), // 记录当前目录
    };
  },
  mounted() {
    TerminalApi.pushMessage(this.name, { content: "hello world" });
    ipcRenderer.on("command-output", (event, message) => {
      const formattedMessage = message.replace(/\n/g, "<br/>");
      TerminalApi.pushMessage(this.name, { content: formattedMessage });
    });
  },
  beforeDestroy() {
    ipcRenderer.removeAllListeners("command-output");
  },
  methods: {
    onKeydown(event) {
        event.preventDefault()
    },
    onExecCmd(key, command, success, failed) {
      // 解析输入命令
      const parts = command.trim().split(" ");
      const cmd = parts[0];
      const args = parts.slice(1);

      // 处理 "cd" 命令
      if (cmd === "cd") {
        if (args.length === 0) {
          failed({type: "text", content: "Error: No directory specified"});
          return;
        }

        // 尝试切换目录
        try {
          const newDir = require("path").resolve(this.currentDirectory, args[0]);
          this.currentDirectory = newDir;
          success({type: "text", content: `Switched to directory: ${newDir}`});
        } catch (error) {
          failed({type: "text", content: `Error: ${error.message}`});
        }
        return;
      }

      // 将命令和当前目录一起发送给主进程
      ipcRenderer.send("execute-command", cmd, args, this.currentDirectory);
      success({type: "text", content: ""});
    },
  },
};
</script>
