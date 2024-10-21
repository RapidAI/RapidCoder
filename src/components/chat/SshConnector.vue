<template>
  <terminal
      :name="name"
      @exec-cmd="onExecCmd"
      :show-header="false"
      :commandStore="cmdStore"
  />
</template>

<script>
import {Terminal, TerminalApi} from "vue-web-terminal";
import "vue-web-terminal/lib/theme/dark.css";
import {TerminalFlash} from 'vue-web-terminal'

const {ipcRenderer} = require("electron");

export default {
  components: {Terminal},
  data() {
    return {
      name: "my-terminal",
      cmdStore: [
        {key: "ls", group: "文件管理", usage: "ls", description: "列出目录中的文件"},
        {key: "cd", group: "文件管理", usage: "cd <directory>", description: "切换到指定目录"},
        {key: "pwd", group: "文件管理", usage: "pwd", description: "显示当前目录路径"},
        {key: "mkdir", group: "文件管理", usage: "mkdir <directory>", description: "创建新目录"},
        {key: "rmdir", group: "文件管理", usage: "rmdir <directory>", description: "删除空目录"},
        {key: "rm", group: "文件管理", usage: "rm <file>", description: "删除文件"},
        {key: "cp", group: "文件管理", usage: "cp <source> <destination>", description: "复制文件或目录"},
        {key: "mv", group: "文件管理", usage: "mv <source> <destination>", description: "移动或重命名文件"},
        {key: "cat", group: "文件内容查看", usage: "cat <file>", description: "显示文件内容"},
        {key: "less", group: "文件内容查看", usage: "less <file>", description: "分页查看文件内容"},
        {key: "more", group: "文件内容查看", usage: "more <file>", description: "分页查看文件内容"},
        {key: "echo", group: "系统操作", usage: "echo <message>", description: "输出信息到终端"},
        {key: "touch", group: "文件管理", usage: "touch <file>", description: "创建空文件或更新文件时间戳"},
        {key: "grep", group: "文件内容查看", usage: "grep <pattern> <file>", description: "搜索文件中的特定模式"},
        {key: "find", group: "文件管理", usage: "find <directory> -name <pattern>", description: "在目录中查找文件"},
        {key: "df", group: "系统信息查看", usage: "df -h", description: "显示磁盘空间使用情况"},
        {key: "du", group: "系统信息查看", usage: "du -h <directory>", description: "查看目录的磁盘使用情况"},
        {key: "top", group: "进程管理", usage: "top", description: "实时显示系统资源使用情况"},
        {key: "ps", group: "进程管理", usage: "ps aux", description: "列出所有进程"},
        {key: "kill", group: "进程管理", usage: "kill <PID>", description: "终止指定进程"},
        {key: "ping", group: "网络操作", usage: "ping <hostname>", description: "测试与主机的连接"},
        {key: "traceroute", group: "网络操作", usage: "traceroute <hostname>", description: "显示到主机的路由"},
        {key: "curl", group: "网络操作", usage: "curl <URL>", description: "从URL获取内容"},
        {key: "wget", group: "网络操作", usage: "wget <URL>", description: "从URL下载文件"},
        {key: "ifconfig", group: "网络操作", usage: "ifconfig", description: "显示网络接口配置"},
        {key: "ipconfig", group: "网络操作", usage: "ipconfig", description: "Windows下显示网络接口配置"},
        {key: "systemctl", group: "系统操作", usage: "systemctl <command>", description: "控制系统服务 (Linux)"},
        {key: "service", group: "系统操作", usage: "service <name> <action>", description: "管理服务 (Linux)"},
        {key: "shutdown", group: "系统操作", usage: "shutdown -h now", description: "立即关机"},
        {key: "reboot", group: "系统操作", usage: "reboot", description: "重启系统"},
        {key: "uptime", group: "系统信息查看", usage: "uptime", description: "查看系统运行时间"},
        {key: "hostname", group: "系统信息查看", usage: "hostname", description: "显示或设置主机名"},
        {key: "uname", group: "系统信息查看", usage: "uname -a", description: "显示系统信息"},
        {key: "chmod", group: "文件管理", usage: "chmod <mode> <file>", description: "更改文件权限"},
        {key: "chown", group: "文件管理", usage: "chown <user>:<group> <file>", description: "更改文件所有者"},
        {key: "scp", group: "网络操作", usage: "scp <source> <user>@<host>:<destination>", description: "通过SSH复制文件"},
        {key: "ssh", group: "网络操作", usage: "ssh <user>@<host>", description: "通过SSH连接到远程主机"},
        {key: "sftp", group: "网络操作", usage: "sftp <user>@<host>", description: "通过SSH连接到SFTP服务器"},
        {key: "tar", group: "文件管理", usage: "tar -czvf <archive>.tar.gz <directory>", description: "创建压缩包"},
        {key: "unzip", group: "文件管理", usage: "unzip <file>.zip", description: "解压缩zip文件"},
        {key: "zip", group: "文件管理", usage: "zip <file>.zip <files>", description: "压缩文件"},
        {key: "apt-get", group: "安装更新", usage: "apt-get install <package>", description: "安装软件包 (Debian/Ubuntu)"},
        {key: "yum", group: "安装更新", usage: "yum install <package>", description: "安装软件包 (RedHat/CentOS)"},
        {key: "brew", group: "安装更新", usage: "brew install <package>", description: "安装软件包 (macOS)"},
        {key: "nano", group: "文件内容查看与编辑", usage: "nano <file>", description: "编辑文件"},
        {key: "vim", group: "文件内容查看与编辑", usage: "vim <file>", description: "编辑文件"},
        {key: "history", group: "系统操作", usage: "history", description: "显示命令历史记录"},
        {key: "alias", group: "系统操作", usage: "alias <name>='<command>'", description: "为命令创建别名"},
        {key: "df", group: "系统信息查看", usage: "df -h", description: "检查磁盘空间"},
        {key: "ln", group: "文件管理", usage: "ln -s <target> <link>", description: "创建符号链接"},
        {key: "clear", group: "系统操作", usage: "clear", description: "清除终端屏幕"},
      ]
    };
  },
  mounted() {
    TerminalApi.pushMessage(this.name, {content: "hello world"});
    ipcRenderer.on('command-output', (event, message) => {
      TerminalApi.pushMessage(this.name, {content: message});
    });
  },
  beforeDestroy() {
    ipcRenderer.removeAllListeners("command-output");
  },
  methods: {
    onExecCmd(key, command, success, failed) {
      ipcRenderer.send('execute-command', command);
      success({type: "text", content: ''});
    },
  },
};
</script>
