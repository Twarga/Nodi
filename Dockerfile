# Stage 1: Front-end Assets (Tailwind CSS)
FROM node:18-alpine AS assets
WORKDIR /app
COPY tailwind.config.js .
COPY web/static/input.css ./web/static/
COPY web/templates/ ./web/templates/
RUN npm install -D tailwindcss
RUN npx tailwindcss -i ./web/static/input.css -o ./web/static/output.css --minify

# Stage 2: Back-end Build (Go)
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Ensure we have the compiled CSS from Stage 1
COPY --from=assets /app/web/static/output.css ./web/static/output.css
RUN go build -o nodi ./cmd/server

# Stage 3: Runtime
FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app

# Copy the binary
COPY --from=builder /app/nodi .

# Copy web templates and static assets
COPY --from=builder /app/web ./web

# Create default storage directory
RUN mkdir -p /data

# Set Environment Variables
ENV QL_PORT=8080
ENV QL_ROOT=/data

EXPOSE 8080

CMD ["./nodi"]
