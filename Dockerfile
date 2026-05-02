# syntax=docker/dockerfile:1.7

# Stage 1: Front-end Assets (Tailwind CSS)
FROM node:20-alpine AS assets
WORKDIR /app
COPY tailwind.config.js .
COPY web/static/input.css ./web/static/
COPY web/templates/ ./web/templates/
RUN npm install --no-audit --no-fund -D tailwindcss@3.4.17
RUN npx tailwindcss -i ./web/static/input.css -o ./web/static/output.css --minify

# Stage 2: Back-end Build (Go)
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
# Ensure we have the compiled CSS from Stage 1
COPY --from=assets /app/web/static/output.css ./web/static/output.css
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o nodi ./cmd/server

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
RUN mkdir -p /data && chown -R nodi:nodi /app /data

# Set Environment Variables
ENV QL_PORT=7319
ENV QL_ROOT=/data

EXPOSE 7319
USER nodi:nodi
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${QL_PORT}/login || exit 1

CMD ["./nodi"]
