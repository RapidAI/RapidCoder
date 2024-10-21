<template>
  <terminal
      :name="name"
      @exec-cmd="onExecCmd"
      :show-header="false"
      :commandStore="cmdStore"
      :context="currentDirectory"
      class="Terminal"
  />
</template>

<script>
import { Terminal,TerminalApi } from "vue-web-terminal";
import "vue-web-terminal/lib/theme/light.css";
import { ref, reactive, onMounted, onBeforeUnmount, computed } from "vue";
import { useSessionStore } from "@/store/sessionStore";
const {ipcRenderer} = require("electron");

export default {
  props: { selectedSessionId: { required: true } },
  components: { Terminal },
  setup(props) {
    const sessionStore = useSessionStore();
    const currentSession = computed(() => {
      return sessionStore.sessions.find(s => s.sessionId === props.selectedSessionId) || null;
    });

    const currentDirectory = ref(
        currentSession.value.currentProjectPath
    );

    const name = ref("my-terminal");

    const cmdStore = reactive([
      { key: "ls", group: "文件管理", usage: "ls", description: "列出目录中的文件" },
      { key: "cd", group: "文件管理", usage: "cd <directory>", description: "切换到指定目录" },
      { key: "pwd", group: "文件管理", usage: "pwd", description: "显示当前目录路径" },
    ]);

    // 定义方法：处理命令执行
    const onExecCmd = (key, command, success, failed) => {
      const parts = command.trim().split(" ");
      const cmd = parts[0];
      const args = parts.slice(1);

      if (cmd === "cd") {
        if (args.length === 0) {
          failed({type: "text", content: "Error: No directory specified"});
          return;
        }

        // 使用 ipcRenderer 调用主进程解析路径
        ipcRenderer.invoke("resolve-path", currentDirectory.value, args[0])
            .then(newDir => {
              currentDirectory.value = newDir;
              success({type: "text", content: `Switched to directory: ${newDir}`});
            })
            .catch(error => {
              failed({type: "text", content: `Error: ${error.message}`});
            });

        return;
      }

      // 其他命令通过 ipcRenderer 与主进程通信
      ipcRenderer.send("execute-command", cmd, args, currentDirectory.value);
      success({type: "text", content: ""});
    };

    // 监听事件，并在组件销毁前移除监听
    onMounted(() => {
      ipcRenderer.on("command-output", (event, message) => {
        const formattedMessage = message.replace(/\n/g, "<br/>");
        TerminalApi.pushMessage(name.value, {content: formattedMessage});
      });
    });

    onBeforeUnmount(() => {
      ipcRenderer.removeAllListeners("command-output");
    });

    // 返回组件所需的响应式状态和方法
    return {
      name,
      currentDirectory,
      cmdStore,
      onExecCmd,
    };
  },
};
</script>
<style>
.Terminal{
  font-size: small;
}
</style>
