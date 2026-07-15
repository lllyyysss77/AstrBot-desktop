# Dashboard React 迁移说明

## 1. 目标与约束

Dashboard 的启用路由已从 Vue 3 + Vuetify 迁移到 React。当前遵循以下约束：

- 新工程固定放在 `new-dashboard/`，旧工程 `dashboard/` 只读保留，便于行为对照和回退。
- 当前迁移阶段以 Web 端功能完整、行为兼容为第一目标，沿用现有样式和静态资源，暂不进行 UI 重设计。
- 新旧版共用 `/api` 接口、浏览器存储键、hash 路由地址和桌面桥接协议。
- 新版开发、测试和构建流程只依赖 `new-dashboard/`，不再启动或打包 Vue 兼容服务。

## 2. 已确认的技术决策

| 项目 | 决策 |
| --- | --- |
| 样式 | React + Sass/CSS；弹窗、菜单等使用无默认外观的 headless 组件 |
| 状态管理 | Zustand |
| 路由 | React Router hash router；全部启用路由由 React 提供 |
| 国际化 | react-i18next；翻译 JSON 和翻译键已迁入新工程 |
| 表单 | React Hook Form + Yup |
| 迁移粒度 | 按完整路由逐页迁移，不拆分为 Vue/React 混合组件 |
| 当前验收重点 | 优先保证 Web 端功能；框架和功能迁移完成后再统一重设计 UI |
| 旧版策略 | 旧版只读保留为功能基准；新版运行时不依赖旧版 |

## 3. 当前迁移阶段

当前已进入“React 独立运行”阶段：

```text
Tauri / 浏览器
  -> React + Vite（new-dashboard，端口 1420）
       -> /api 代理到 AstrBot（端口 6185）
```

开发态只启动 1420 的 React Vite 服务；生产构建只生成 `new-dashboard/dist`。旧版 Vue Dashboard 不参与新版开发和构建流程，且本次收口未修改 `dashboard/`。

## 4. 目录职责

| 路径 | 职责 |
| --- | --- |
| `dashboard/` | 只读保留的旧版 Vue Dashboard；迁移期间也是视觉和行为基准 |
| `new-dashboard/` | React + TypeScript + Vite 新工程 |
| `new-dashboard/src/app/AppRouter.tsx` | React 路由入口和鉴权装配 |
| `scripts/run-tauri-new.mjs` | 新版 Tauri 入口；通过配置覆盖选择新版开发与构建命令 |
| `scripts/run-dashboard-new.mjs` | 启动独立 React 开发服务 |
| `scripts/prepare-webui-new.mjs` | 构建新版 WebUI 并同步到 `resources/webui` |

原有 `scripts/run-tauri.mjs`、`scripts/prepare-resources.mjs` 和 `scripts/prepare-resources/` 下的旧任务脚本保持不变。新版逻辑只存在于带 `-new` 后缀的增量脚本中。

## 5. 安装依赖

根目录和新版依赖分别安装：

```bash
pnpm install
pnpm run install:dashboard:new
```

现有 `make deps` 保持原行为，只安装根目录和旧版 Dashboard 依赖，不会隐式安装新版依赖。

## 6. 启动命令

只启动前端：

```bash
# 新版 React 入口
pnpm run dev:dashboard:new

# 旧版 Vue Dashboard
pnpm run dev:dashboard
```

启动完整 Tauri 桌面应用：

```bash
# 新版 Dashboard
pnpm run dev:new

# 旧版 Dashboard
pnpm run dev
```

为保持现有开发习惯，原命令 `pnpm run dev` 和 `pnpm run dev:dashboard` 未被修改，仍启动旧版。新版必须使用带 `:new` 或 `new` 后缀的独立命令；当前没有通过环境变量切换版本的机制。

## 7. 构建命令

```bash
# 使用 React 入口打包桌面应用
pnpm run build:new

# 使用旧版 Vue Dashboard 打包
pnpm run build
```

原有 `pnpm run build` 未被修改，继续构建旧版。新版 WebUI 构建流程为：

1. 检查并安装 `new-dashboard/` 依赖。
2. 类型检查并构建 `new-dashboard/`。
3. 将 `new-dashboard/dist` 同步到 `resources/webui`。
4. 继续准备后端资源并执行 Tauri 打包。

只准备新版 WebUI 或新版完整资源时，可以分别运行：

```bash
pnpm run prepare:webui:new
pnpm run prepare:resources:new
```

单独检查新版类型：

```bash
pnpm run typecheck:dashboard:new
```

## 8. 页面维护规范

新增或调整路由时：

1. 在 `new-dashboard/src` 中实现 React 页面，并保持原 hash 路径不变。
2. 复用旧版主题 token、字体和静态资源，保持页面可用且不存在明显布局回归；像素级一致不作为当前功能迁移的阻塞条件。
3. API 请求与旧版使用相同的 URL、请求体、错误处理和鉴权存储键。
4. 优先在 Web 端对照旧版验证功能、路由和数据状态。
5. 覆盖中文/英文、空数据、加载和错误状态；主题与多尺寸视觉精修安排在 UI 重设计阶段。
6. 在集中路由清单中登记，并补充路由与业务测试。

通用能力依次抽成 React 模块：Sass/CSS token、Zustand stores、react-i18next、HTTP 客户端、认证状态、React Hook Form/Yup、Toast/Confirm、桌面桥接和路由加载状态。业务页不应直接重新定义这些协议。

## 9. 当前验收标准

当前阶段以 Web 功能验收为主：

- 路由、刷新、深链接和权限重定向与旧版一致。
- API、鉴权、本地存储和错误处理与旧版兼容。
- 页面主要操作、数据状态和业务流程可用。
- 中文和英文内容正确，页面不存在阻断使用的布局问题。
- headless 组件具备键盘操作、焦点管理和必要的无障碍语义。

React 框架和全部功能完成迁移后，再启动独立的 UI 重设计阶段，届时重新制定视觉规范、响应式范围和截图基线。桌面端专项验证也安排在 Web 功能稳定之后。

## 10. 回退方式

如果新版入口出现问题，无需删除代码或回滚资源：开发时改回原命令 `pnpm run dev`，构建时改回 `pnpm run build` 即可。新旧工程使用各自的 `dist` 目录；资源准备时，最后执行的版本会覆盖 `resources/webui`。

`dashboard/` 不会因为单个页面完成迁移而删除。只有全部路由、通用能力、Web 功能和后续桌面验证完成，并经过单独评审后，才能开始旧版下线工作。

## 11. 实现提交

当前迁移基线由三笔独立提交组成：

1. `cb70c8e`：创建 `new-dashboard/` React + TypeScript + Vite 工程。
2. `b0b8912`：增加新版命令入口，并从原 `run-tauri.mjs` 复制出隔离的 `run-tauri-new.mjs`。
3. `241078b`：只在新版脚本中实现 React 开发服务、Tauri 配置覆盖和新版 WebUI 构建流程。
