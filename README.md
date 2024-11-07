# MyCodeGPT

MyCodeGPT 是一个基于 Electron 和 Vue 的桌面应用程序，可在本地环境中使用 GPT 技术进行编码支持。

## 特性

- 使用 Codemirror 提供编辑器功能。
- 支持多种编程语言语法高亮。
- 支持文件及目录的实时监控与管理。
- 内置命令行终端。

## 项目结构

- `main.js` 主进程代码。
- `vite.config.js` Vite 配置文件。
- `package.json` 项目依赖与脚本配置。

## 技术栈

- Electron: 用于创建桌面应用。
- Vite: 作为开发服务器与构建工具。
- Vue 3: 前端框架。
- Codemirror: 提供强大的代码编辑功能。

## 安装与运行

1. 确保已安装 [Node.js](https://nodejs.org/) 和 [npm](https://npmjs.com/)。
2. 克隆项目仓库：
   ```bash
   git clone <repository-url>
   cd mycodegpt-frontend
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 启动开发环境：
   ```bash
   npm run electron:dev
   ```
   - 开发环境默认访问 `http://localhost:5173`。
   - 代码修改后将自动更新。

## 打包构建

- 构建项目以供生产使用：
  ```bash
  npm run electron:build
  ```
- 针对 macOS 的构建：
  ```bash
  npm run electron:mac
  ```

## 常见问题

- 如果 Electron 无法启动，确保确保 Python 环境已配置，并已经设置 `NODE_GYP_FORCE_PYTHON=python3`。
- 打包时未加载资源，确保打包路径下存在 `dist` 目录。

## 贡献

欢迎贡献代码！请 fork 代码并提交 Pull Request。此外，提交 issue 是反馈问题的好方式。

## 许可

MIT © qixing
