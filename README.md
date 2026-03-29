# Sesame Agent ✨

> 一个类 Claude Artifacts 的 AI 全栈 Web 应用原型。用自然语言描述想法，AI 实时生成并渲染前端应用。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + Tailwind CSS + React Router |
| 后端 | Go + Gin + GORM + JWT |
| 数据库 | SQLite（纯 Go，无 cgo 依赖） |
| AI | OpenAI GPT-4o / Anthropic Claude / Qwen（可配置） |

## 快速启动

### 前置条件

- Go 1.22+
- Node.js 18+

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 API_KEY 和 JWT_SECRET
```

### 2. 一键启动

```bash
make dev
# 或者分别启动：
# make dev-backend   # 后端 :8080
# make dev-frontend  # 前端 :5173
```

打开 http://localhost:5173 → 注册账号 → 登录 → 开始对话。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端端口 | `8080` |
| `LLM_PROVIDER` | LLM 提供商：`openai` / `anthropic` | `openai` |
| `API_KEY` | LLM API 密钥 | — |
| `MODEL_NAME` | 模型名称 | `gpt-4o` |
| `BASE_URL` | 自定义 API 地址（如 Qwen） | 空（使用默认） |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `DB_PATH` | SQLite 数据库路径 | `./data.db` |
| `VITE_API_BASE_URL` | 前端连接后端地址 | `http://localhost:8080` |

### 使用 Qwen

```env
LLM_PROVIDER=openai
API_KEY=sk-xxxxxxxxxxxxx
MODEL_NAME=qwen-plus
BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## API

### 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册（username + password） |
| POST | `/api/auth/login` | 登录，返回 JWT token |

### 业务（需要 `Authorization: Bearer <token>`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/chat` | 发送消息（SSE 流式响应） |
| GET | `/api/history/:session_id` | 获取对话历史 |
| GET | `/health` | 健康检查 |

## 架构

```
用户 → 登录/注册 → JWT Token
                ↓
        POST /api/chat → LLM (SSE) → 前端实时渲染
                ↓
     SQLite 持久化 (users + sessions + messages)
     所有数据按 user_id 隔离
```

## 功能

- 🔐 JWT 认证 + 用户数据隔离
- 🤖 支持 OpenAI / Claude / Qwen 等多种 LLM
- ⚡ SSE 流式输出，打字机效果实时展示 AI 回复
- 🖼️ iframe 沙箱安全渲染生成的 HTML/JS/CSS 应用
- 💾 SQLite 持久化对话历史，刷新页面自动恢复
- 🛑 支持随时中断生成
- 📱 Markdown 渲染（代码高亮、表格、列表）

## 部署

### 一键打包

```bash
make dist
```

产物目录 `dist/` 包含：
- `dist/` — 前端静态文件
- `sesame-server` — Go 二进制（Linux AMD64）
- `nginx.conf` — nginx 配置模板
- `.env` — 环境变量配置（从 .env.example 复制）

### 部署步骤

1. **上传** `dist/` 目录到服务器

2. **配置环境变量**
   ```bash
   cd dist
   vim .env  # 填入 API_KEY、JWT_SECRET 等
   ```

3. **配置 nginx**
   ```bash
   # 编辑 nginx.conf 中的 server_name 和 root 路径
   sudo cp nginx.conf /etc/nginx/conf.d/sesame.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. **启动后端**
   ```bash
   chmod +x sesame-server
   ./sesame-server

   # 或使用 systemd：
   # sudo cp deploy/sesame.service /etc/systemd/system/
   # sudo systemctl enable --now sesame
   ```

### 开发常用命令

```bash
make build          # 构建全部（前端 + 后端）
make test           # 运行全部测试
make lint           # 代码检查
make clean          # 清理构建产物
make deploy-help    # 部署帮助
```
