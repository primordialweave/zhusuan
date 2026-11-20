FROM golang:1.26.11-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git gcc musl-dev

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -ldflags="-w -s" -o /zhusuan-api ./cmd/server

FROM alpine:3.24.4

RUN apk --no-cache add ca-certificates tzdata wget && adduser -D -H zhusuan

ENV API_SERVER_HOST=0.0.0.0
ENV API_SERVER_PORT=3456
ENV RUNTIME_MODE=server
ENV TZ=Asia/Shanghai
ENV ZHUSUAN_CONFIG_ROOT=/app/data

WORKDIR /app

COPY --from=builder /zhusuan-api /usr/local/bin/zhusuan-api

RUN mkdir -p /app/data /app/logs && chown -R zhusuan:zhusuan /app

USER zhusuan

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3456/api/health || exit 1

CMD ["zhusuan-api"]
