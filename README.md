# MyCodeGPT

MyCodeGPT 是一个基于 Electron 和 Vue 的桌面应用程序，可在本地环境中使用 GPT 技术进行编码支持。

## 特性

- 使用 Codemirror 提供编辑器功能。
- 支持多种编程语言语法高亮。
- 支持文件及目录的实时监控与管理。
- 内置命令行终端。
- 按住 `Ctrl` 或 `Shift` 可以多选文件进行联合关联编辑。

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

bug:
关闭项目后没法新建

```shell
curl 'https://auth.openai.com/authorize?client_id=TdJIcbe16WoTHtN95nyywh5E4yOo6ItG&scope=openid%20email%20profile%20offline_access%20model.request%20model.read%20organization.read%20organization.write&response_type=code&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fapi%2Fauth%2Fcallback%2Flogin-web&audience=https%3A%2F%2Fapi.openai.com%2Fv1&device_id=d15c7c4e-bc3e-4c9d-a23b-88d596de21d0&prompt=login&screen_hint=login&ext-oai-did=d15c7c4e-bc3e-4c9d-a23b-88d596de21d0&ext-login-allow-phone=true&country_code=US&state=3otr-MiiSH8-5Fxlk76NhoXjUcT_DJRxAJBV2bvoeS8&code_challenge=jdE0qu0fZ4y-kz2B0b3C8vrbWHg01sOtQoOM2_w64aI&code_challenge_method=S256' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: zh-CN,zh;q=0.9' \
  -H 'cache-control: no-cache' \
  -H 'cookie: _cfuvid=AtOo76qfTW.EVKUiFy0JOt2D_0kF6UuVQzxigdlaUCs-1731317883025-0.0.1.1-604800000; oai-did=d15c7c4e-bc3e-4c9d-a23b-88d596de21d0; __cf_bm=K3Wemcl29NyGBJ1r0LWR3zbFHFTjNXck0Rh3BcBNYD8-1731372233-1.0.1.1-Yj4wjqmGX1qGEDjl.efRC1g88c2kYJC36nife8XlsjznzitlU2p_2X1tQaG.KR7cAEKdzDM8xVcfDA1fZKD2Eg; cf_clearance=yKZeLK3POn2BfVxBaTTmdKXYRfgHaykAgs5FdHxgcuU-1731372234-1.2.1.1-NFz08IfqjZTpUsI6UIyyCB5_Tj673DScbSgnuzXqcOXQO6idlfyjSCpdyFP.qqGgqoYcaoXG_PU8FMmimBLoJLeDtUuBI5CSO7fAM8fftFw.AwKoAdElKC3qipp1ECtcQA8IHb6BgFrssRyoByv89Sy0515y96SqLY.IVMcJQOjzo122JG_5MVrOT1o2VUva8Xt24QiKCabTl_dlNj0IZR1JPyW8.7lot1Iy8.oa3U_V3Ge1YMJBA4PrsmfgZazJXW_R5w8dq7rzF96oKbeMlGJccjFJ1iQ5GlynNgJmRJnw7EVDr9U7QORedW8ugJF8d9aQL3qVccntVprLpgPEDMkG3Qw_M3lAtR4hB1C3h8Y1_0W5t_dyOaL.Ra0YbSPpvlHqTRmsAnVhxYzT4okYLA' \
  -H 'pragma: no-cache' \
  -H 'priority: u=0, i' \
  -H 'referer: https://chatgpt.com/' \
  -H 'sec-ch-ua: "Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"' \
  -H 'sec-ch-ua-arch: "arm"' \
  -H 'sec-ch-ua-bitness: "64"' \
  -H 'sec-ch-ua-full-version: "130.0.6723.117"' \
  -H 'sec-ch-ua-full-version-list: "Chromium";v="130.0.6723.117", "Google Chrome";v="130.0.6723.117", "Not?A_Brand";v="99.0.0.0"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-model: ""' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-ch-ua-platform-version: "15.1.0"' \
  -H 'sec-fetch-dest: document' \
  -H 'sec-fetch-mode: navigate' \
  -H 'sec-fetch-site: cross-site' \
  -H 'sec-fetch-user: ?1' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
```