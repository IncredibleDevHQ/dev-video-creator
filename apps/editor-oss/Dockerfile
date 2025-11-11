FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY apps/editor-oss/go.mod apps/editor-oss/go.sum ./
RUN go mod download

COPY apps/editor-oss/. ./

ENV CGO_ENABLED=0
RUN go build -o /editor ./cmd/server

FROM gcr.io/distroless/base-debian12

ENV EDITOR_API_PORT=8081

COPY --from=builder /editor /editor

EXPOSE 8081

ENTRYPOINT ["/editor"]
