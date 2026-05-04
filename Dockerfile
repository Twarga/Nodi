# syntax=docker/dockerfile:1.7

# Stage 1: Front-end Build (Vite + Preact)
FROM node:22-alpine AS frontend
WORKDIR /app/web/app
COPY web/app/package.json web/app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/app/ ./
RUN npm run build

# Stage 2: Back-end Build (Go)
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
# Copy the built frontend from Stage 1
COPY --from=frontend /app/web/static/dist ./web/static/dist
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=$(git describe --tags --always 2>/dev || echo dev)" -o nodi ./cmd/server

# Stage 3: Runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates \
    && addgroup -S nodi \
    && adduser -S -G nodi -h /app nodi
WORKDIR /app

# Copy the binary
COPY --from=builder /app/nodi .

# Copy web templates and static assets
COPY --from=builder /app/web ./web

# Create default storage directory
RUN mkdir -p /nodi_files && chown -R nodi:nodi /app /nodi_files

# Set Environment Variables
ENV QL_HOST=0.0.0.0
ENV QL_PORT=7319
ENV QL_ROOT=/nodi_files

EXPOSE 7319
USER nodi:nodi
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${QL_PORT}/api/health || exit 1

CMD ["./nodi"]
