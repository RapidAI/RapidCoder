<template>
  <terminal
      :name="name"
      @exec-cmd="onExecCmd"
      :show-header="false"
      :commandStore="cmdStore"
  />
</template>

<script>
import { Terminal, TerminalApi } from "vue-web-terminal";
import "vue-web-terminal/lib/theme/dark.css";

export default {
  components: {Terminal},
  data() {
    return {
      name: "my-terminal",
      cmdStore: [
        {key: "fail", group: "demo", usage: "fail", description: "模拟错误结果返回"},
        {key: "json", group: "demo", usage: "json", description: "模拟json结果显示"},
        {key: "code", group: "demo", usage: "code", description: "模拟code结果显示"}
      ],
    };
  },
  mounted() {
    TerminalApi.pushMessage(this.name, {content: "hello world"});
  },
  methods: {
    onExecCmd(key, command, success, failed) {
      switch (key) {
        case "fail":
          failed("Something went wrong!");
          break;
        case "json":
          success({
            type: "json",
            content: {
              message: "welcome to vue-web-terminal",
              value: 120,
              list: ["vue", "web", "terminal"]
            }
          });
          break;
        case "code":
          success({
            type: "code",
            content: `const app = new Vue({ el: '#app' })`
          });
          break;
        default:
          failed("Unknown command");
      }
    },
  },
};
</script>
