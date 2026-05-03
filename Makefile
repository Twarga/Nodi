.PHONY: build run dev test lint css css-watch docker clean help frontend frontend-watch

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION)"
BINARY := ./server

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

frontend: ## Build the Preact frontend (production)
	@cd web/app && npm run build

frontend-watch: ## Build the Preact frontend and watch for changes
	@cd web/app && npm run dev

build: frontend ## Build the Go binary
	CGO_ENABLED=0 go build $(LDFLAGS) -o $(BINARY) ./cmd/server

run: build ## Build and run the server
	$(BINARY)

dev: ## Run in development mode (Vite dev server + Go)
	@echo "==> Starting dev server..."
	@echo "    Frontend: http://localhost:5173"
	@echo "    Backend:  http://localhost:7319"
	@cd web/app && npm run dev &
	@go run ./cmd/server

test: ## Run all tests
	go test -race -count=1 ./...

lint: ## Run golangci-lint
	golangci-lint run ./...

# Legacy alias for compatibility
css: frontend

css-watch: frontend-watch

docker: ## Build Docker image
	docker build -t nodi:latest .

clean: ## Remove build artifacts
	rm -f $(BINARY)
	rm -rf web/static/dist/assets
	go clean -cache
