# n8n 低代码平台前端 (UI Builder)

基于 React + Vite + TypeScript 构建的可视化低代码编辑器，旨在与 n8n 工作流无缝集成，提供灵活的前端页面构建能力。

## ✨ 核心特性

- **可视化拖拽编排**：
  - 支持所见即所得（WYSIWYG）的页面搭建。
  - 强大的拖拽系统：支持组件排序、跨容器移动、多层嵌套布局。
- **丰富的组件体系**：
  - **布局组件**：Container, Row, Column（支持 Flexbox 布局配置）。
  - **基础组件**：Text, Image, Button, Input, Select。
  - **数据组件**：Data Table（支持动态数据绑定）。
- **动态数据绑定**：
  - 内置 Mustache 语法引擎，支持 `{{ user.name }}` 形式的数据绑定。
  - 实时响应式更新：输入框和数据源的双向或单向绑定。
- **事件驱动交互**：
  - 支持 `onClick`, `onChange` 等生命周期事件。
  - 内置动作库：
    - **n8n Webhook**：无缝调用 n8n 工作流并处理响应数据。
    - **Set State**：更新全局运行时状态。
    - **Alert/Console**：调试与反馈。
- **可视化样式编辑**：无需编写 CSS，通过面板配置宽高、边距、颜色及 Flex 布局属性。
- **Schema 驱动**：页面结构完全由 JSON 描述，支持 Schema 的导出与导入（持久化）。

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- pnpm (推荐) 或 npm/yarn

### 安装依赖

在项目根目录下运行：

```bash
pnpm install
```

### 启动开发服务器

```bash
# 在根目录运行
pnpm dev

# 或者进入 ui-builder 目录运行
cd apps/ui-builder
pnpm dev
```

启动后，访问终端显示的本地地址（通常为 `http://localhost:5173`）。

## 📂 项目结构

```text
apps/ui-builder/
├── src/
│   ├── components/
│   │   └── renderer/
│   │       └── RecursiveRenderer.tsx  # 核心渲染引擎：负责递归渲染组件树及处理拖拽逻辑
│   ├── store/
│   │   └── editorStore.ts             # 状态管理 (Zustand)：管理组件 Schema 树及运行时数据 (StoreData)
│   ├── types/
│   │   └── schema.ts                  # 类型定义：定义组件结构、属性及动作接口
│   ├── utils/
│   │   ├── actionRunner.ts            # 动作执行器：处理事件触发后的逻辑（如 n8n 请求）
│   │   └── evaluator.ts               # 表达式引擎：解析 {{ variable }} 动态语法
│   ├── App.tsx                        # 主应用入口：包含编辑器布局、属性面板、工具栏及拖拽上下文
│   └── index.css                      # 全局样式 (Tailwind Directives)
├── package.json
└── vite.config.ts
```

## 📖 使用指南

1. **布局搭建**：
   - 从左侧组件库点击添加组件。
   - 使用 `Row` 和 `Column` 容器构建网格系统。
   - 拖拽组件调整层级和顺序。

2. **属性配置**：
   - 选中组件，右侧面板 "Properties" 配置基础属性（支持表达式）。
   - 切换到 "Styles" 面板可视化调整外观。

3. **逻辑定义**：
   - 切换到 "Events" 面板。
   - 为按钮添加 `onClick` 事件，选择 `n8n-webhook` 动作。
   - 配置 Webhook URL 和 Response Mapping（将 n8n 返回的数据映射回本地状态）。

4. **调试与预览**：
   - 点击顶部 "Data State Debugger" 查看当前的全局数据状态。
   - 点击 "Preview" 进入预览模式，测试交互逻辑。
   - 点击 "Save/Load" 保存当前的页面 Schema。
