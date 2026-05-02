.PHONY: build run dev test lint css css-watch docker clean help

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-s -w -X main.version=$(VERSION)"
BINARY := ./server
TAILWIND := ./tailwindcss-linux-x64

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: css ## Build the Go binary
	CGO_ENABLED=0 go build $(LDFLAGS) -o $(BINARY) ./cmd/server

run: build ## Build and run the server
	$(BINARY)

dev: css ## Run in development mode (CSS watch + Go run)
	@echo "==> Starting dev server..."
	@$(TAILWIND) -i ./web/static/input.css -o ./web/static/output.css --watch &
	@go run ./cmd/server

test: ## Run all tests
	go test -race -count=1 ./...

lint: ## Run golangci-lint
	golangci-lint run ./...

css: ## Compile Tailwind CSS (minified)
	$(TAILWIND) -i ./web/static/input.css -o ./web/static/output.css --minify

css-watch: ## Compile Tailwind CSS and watch for changes
	$(TAILWIND) -i ./web/static/input.css -o ./web/static/output.css --watch

docker: ## Build Docker image
	docker build -t nodi:latest .

clean: ## Remove build artifacts
	rm -f $(BINARY) $(TAILWIND)
	rm -f web/static/output.css
	go clean -cache

bootstrap: ## Download Tailwind CSS binary if missing
	@if [ ! -f "$(TAILWIND)" ]; then \
		echo "==> Downloading Tailwind CSS standalone CLI..."; \
		curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64; \
		chmod +x tailwindcss-linux-x64; \
	fi