.PHONY: all build build-frontend build-backend back-build-linux dev dev-backend dev-frontend test test-backend test-frontend lint vet clean dist deploy-help

# ---- 默认目标 ----
all: build

# ---- 构建全部 ----
build: build-frontend build-backend

# ---- 构建前端 ----
build-frontend:
	cd frontend && npm ci && npm run build

# ---- 构建后端（本地开发，静态链接，无 cgo） ----
build-backend:
	cd backend && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../bin/sesame-server .

# ---- 构建后端（Linux amd64 交叉编译，通过 Docker） ----
back-build-linux:
	docker run --platform linux/amd64 --rm -v $(PWD)/backend:/app -v $(HOME)/go/pkg/mod:/go/pkg/mod -w /app golang:1.25.0 sh -c "go env -w GOPROXY=https://goproxy.cn,direct && mkdir -p build && CGO_ENABLED=0 go build -ldflags='-s -w' -o build/server main.go"

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
	rm -rf backend/build/
	rm -rf dist/

# ---- 部署产物打包（前端本地构建 + 后端 Docker 交叉编译 Linux） ----
dist: build-frontend back-build-linux
	mkdir -p dist
	cp -r frontend/dist dist/
	cp backend/build/server dist/sesame-server
	cp -n .env.example dist/.env 2>/dev/null || true
	cp deploy/nginx.conf dist/
	@echo "✅ Deployment package ready in dist/"

# ---- 帮助 ----
deploy-help:
	@echo ""
	@echo "🚀 Sesame Agent Deployment Guide"
	@echo "==============================="
	@echo ""
	@echo "1. Build (local): make build"
	@echo "2. Build (linux):  make back-build-linux"
	@echo "3. Package:       make dist"
	@echo "3. Upload dist/ to server"
	@echo ""
	@echo "Server Setup:"
	@echo "  a) Edit dist/.env with your API keys and JWT_SECRET"
	@echo "  b) Copy dist/nginx.conf to /etc/nginx/conf.d/sesame.conf"
	@echo "  c) Set root path in nginx.conf to your dist directory"
	@echo "  d) nginx -t && systemctl reload nginx"
	@echo "  e) ./sesame-server  (or use systemd)"
	@echo ""
