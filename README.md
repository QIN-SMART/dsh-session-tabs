# 轻量会话标签 / dsh-session-tabs

单客户端会话标签，复用 DSH 原生聊天视图和任务服务，保留左右侧栏及底部工作台。无 iframe，无运行时依赖。

[English](README_EN.md) · 版本 0.1.5 · MIT

[![verify](https://github.com/QIN-SMART/dsh-session-tabs/actions/workflows/verify.yml/badge.svg)](https://github.com/QIN-SMART/dsh-session-tabs/actions/workflows/verify.yml)
[![npm](https://img.shields.io/npm/v/dsh-session-tabs.svg)](https://www.npmjs.com/package/dsh-session-tabs)

![合成会话中的标签栏与面板按钮](https://raw.githubusercontent.com/QIN-SMART/dsh-session-tabs/main/docs/assets/session-tabs.png)

## 当前状态

已针对 DSH **0.2.0-rc.2** 验证，源代码采用 MIT 协议。DSH 的客户端 API 仍在演化，升级宿主后需要重新验收。

## 使用

- 原生左栏打开的会话自动加入顶部标签。点击标签切换，`＋` 使用原生新建会话。
- 当前标签与内容区使用同一亮色表面，通过两侧底部反向圆角衔接；其他标签在较暗背景上，悬停时标题和关闭按钮共用一块灰色底色。跟随 DSH 的亮/暗主题。
- `＋` 紧跟标签，与 `×` 图标居中对齐，旁边不再显示 `⋯`。底部工作区和右侧栏入口位于标签行右端，复用对应原生按钮的图标、状态和点击事件。右栏展开后，中央的打开入口隐藏，只保留窗口最右侧原生收起按钮；打开按钮采用相同的 28px 点击区域和 15px 图标。原生其他标题栏按钮保持原位。缺少原生入口时不显示对应按钮，切回原生视图或卸载时恢复原入口。
- 右栏开关位置在动画期间固定保留，底部按钮不会挤进来。收起时若原生打开入口尚未恢复，该位置暂时禁用；就绪后恢复点击。两个按钮均使用 28px 点击区域并居中对齐，底部图标沿用原生 16px。
- `×` 只关闭标签，不删除、归档或停止会话。运行或待确认的会话在后台保留，结束后释放额外引用。
- 左栏底部的「标签窗口」线条图标用于显示/隐藏标签，悬停显示目标视图名称。焦点在标签栏内时，`⌘/Ctrl + Shift + T` 可恢复本次打开窗口内刚关闭的标签；输入框不拦截此快捷键。
- 拖动调整顺序；标签获得焦点后，左右方向键切换，`Alt + Shift + 左/右` 调整顺序。输入框没有新增全局快捷键，中文组字不受拦截。
- `●` 运行中，`!` 等待确认，`✓` 完成未读，`…` 正在连接；空闲时不显示状态圆点。

关闭整个客户端、卸载插件与关闭标签是不同操作。原生任务的存续仍由宿主负责。不同会话同时修改同一文件的冲突也仍由宿主与用户处理。

## 安装与回退

### 从 npm 安装和下载（推荐）

npm 页面：[dsh-session-tabs](https://www.npmjs.com/package/dsh-session-tabs)。建议先在独立 profile 试用。

**Desktop：**在应用内插件管理器添加 `dsh-session-tabs`。

**Web：**使用 DSH 命令安装：

```sh
dsh plugin --profile web add dsh-session-tabs@0.1.5
```

如果使用 npm 手动管理 profile，先进入目标 profile 目录，再执行：

```sh
npm install dsh-session-tabs@0.1.5 --ignore-scripts
```

手动安装包后，还需在该 profile 的 `dsh.profile.bundles` 中启用 `dsh-session-tabs`，再刷新或重开 DSH；DSH 插件管理器和上面的 `dsh plugin` 命令会处理插件启用。

**只下载离线安装包：**在希望保存文件的目录运行：

```sh
npm pack dsh-session-tabs@0.1.5
```

会生成 `dsh-session-tabs-0.1.5.tgz`，可在 DSH 插件管理器中用该文件的完整路径添加。

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:QIN-SMART/dsh-session-tabs
```

CLI 的 `--profile desktop` 是保留名称，不能套用上述 Web 命令。已有本地安装的用户可在目标 profile 的包管理器更新为 `dsh-session-tabs@0.1.5`，再完全退出并重开应用。开发用的模拟模型和测试 profile 不包含在 npm 包中。

临时回退：点击左栏底部的视图切换图标。完整移除：在目标 profile 的插件管理器移除 `dsh-session-tabs`，再刷新客户端；注入节点、样式、订阅与会话引用会清理。浏览器本地标签清单仍保留，可在需要时清除该站点的 `dsh-session-tabs.v1` 键。

## 状态和性能

标签顺序、启用偏好及活动身份存于 `localStorage['dsh-session-tabs.v1']`。刷新恢复标签；失效/归档 ID 会剔除。不同窗口同步偏好与标签身份，但不会抢占另一个窗口的当前会话。

只有一棵原生聊天视图。重开客户端时，非活动标签只恢复身份，不立即加载全部历史。已经访问过的标签保留轻量会话绑定，以沿用原生草稿/附件状态；其数量仍会影响内存，因此本插件不承诺无限标签或固定内存开销。草稿沿用原生机制，本插件不提供跨重启草稿持久化保证。

标签节点按身份复用，点击后立即更新标签；后台状态通知合并更新，浏览器存储写入短暂合并。实际会话内容仍由宿主原生导航加载，不能保证所有开关操作即时完成。实际验证范围与兼容性边界见 [验收说明](docs/validation.md)。

中心挂载点使用稳定 `data-slot="main"`，没有专用的官方标签栏插槽；宿主结构变化是主要兼容性风险。原生 sidebar/rightbar 插槽和右栏服务没有被替换或代理。顶栏入口仅转发到仍留在原处的原生控件，不搬动 React 管理的节点。若挂载失败，回滚新增节点并保留原生界面。

## 开发与验收

开发本仓库时：

```sh
node --test test/verify.mjs
node tools/start-test-profile.mjs --runtime /absolute/path/to/installed/@deepseek-ai/dsh --port 3096
# 可选复用已安装的右栏插件：--better-sidebar /absolute/path/to/dsh-better-sidebar
```

测试数据、profile 和日志仅写入本仓库 `.tmp/`。测试模型 `Local delayed echo` 本地流式输出约 60 秒，无网络模型请求；需在界面中明确选择该模型后发送合成任务。它仅用于验证并发、关闭和取消隔离。

真实 GUI 冒烟：`node tools/real-ui-check.mjs --url-file /absolute/path/to/test-url.txt --out docs/real-ui.png`，URL 文件仅保存隔离服务启动时给出的本机认证 URL，不提交。连接自己启动的 Electron 验收副本可用 `--connect-port 9346 --target-match <observed-main-target>`。`--edge-ui-check` 检查右栏开关；配合 `--handoff-ui-check` 在上述合成会话中检查底部按钮规格、连续点击和动画期间的位置。范围见 [验收说明](docs/validation.md)。

源码不需要构建，`lib/client.js` 即真实客户端产物；`npm pack` 只包含生产插件和说明，不包含测试模型、日志、profile、桌面副本或截图。

## License

[MIT](LICENSE)。
