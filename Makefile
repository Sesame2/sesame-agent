.PHONY: all build build-frontend build-backend dev dev-backend dev-frontend test test-backend test-frontend lint vet clean dist deploy-help

# ---- 默认目标 ----
all: build

# ---- 构建全部 ----
build: build-frontend build-backend

# ---- 构建前端 ----
build-frontend:
	cd frontend && npm ci && npm run build

# ---- 构建后端（静态链接，无 cgo） ----
build-backend:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/sesame-server .

# ---- 开发模式 ----
dev: dev-backend dev-frontend

dev-backend:
	cd backend && go run .

dev-frontend:
	cd frontend && npm run dev

# ---- 测试 ----
test: test-backend test-frontend

test-backend:
	cd backend && go test ./... -v

test-frontend:
	cd frontend && ./node_modules/.bin/vitest run

# ---- 代码检查 ----
lint: lint-frontend vet-backend

lint-frontend:
	cd frontend && npm run lint

vet-backend:
	cd backend && go vet ./...

# ---- 清理 ----
clean:
	rm -rf frontend/dist
	rm -rf bin/
	rm -rf dist/

# ---- 部署产物打包 ----
dist: build
	mkdir -p dist
	cp -r frontend/dist dist/
	cp bin/sesame-server dist/
	cp -n .env.example dist/.env 2>/dev/null || true
	cp deploy/nginx.conf dist/
	@echo "✅ Deployment package ready in dist/"

# ---- 帮助 ----
deploy-help:
	@echo ""
	@echo "🚀 Sesame Agent Deployment Guide"
	@echo "==============================="
	@echo ""
	@echo "1. Build:         make build"
	@echo "2. Package:       make dist"
	@echo "3. Upload dist/ to server"
	@echo ""
	@echo "Server Setup:"
	@echo "  a) Edit dist/.env with your API keys and JWT_SECRET"
	@echo "  b) Copy dist/nginx.conf to /etc/nginx/conf.d/sesame.conf"
	@echo "  c) Set root path in nginx.conf to your dist directory"
	@echo "  d) nginx -t && systemctl reload nginx"
	@echo "  e) ./sesame-server  (or use systemd)"
	@echo ""
