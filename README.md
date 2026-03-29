# Sesame Agent ✨

> 一个类 Claude Artifacts 的 AI 全栈 Web 应用原型。用自然语言描述想法，AI 实时生成并渲染前端应用。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + Tailwind CSS |
| 后端 | Go + Gin + GORM |
| 数据库 | SQLite（无 cgo 依赖） |
| AI | OpenAI GPT-4o / Anthropic Claude（可配置） |

## 快速启动

### 前置条件

- Go 1.22+
- Node.js 18+

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 API_KEY
```

### 2. 启动后端

```bash
cd backend
go run main.go
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 开始使用。

## 架构

```
用户输入 → POST /api/chat → LLM (SSE) → 前端实时渲染
                ↓
     SQLite 持久化 (sessions + messages)
```

## 功能

- 🤖 接入 OpenAI GPT-4o 或 Anthropic Claude（环境变量切换）
- ⚡ SSE 流式输出，打字机效果实时展示 AI 回复
- 🖼️ iframe 沙箱安全渲染生成的 HTML/JS/CSS 应用
- 💾 SQLite 持久化对话历史，刷新页面自动恢复
- 🛑 支持随时中断生成

## 部署

**后端**
```bash
cd backend
go build -o sesame-backend
./sesame-backend
```

**前端**（部署到 Vercel）
```bash
cd frontend
npm run build
# 设置环境变量 VITE_API_BASE_URL 指向后端地址
```
