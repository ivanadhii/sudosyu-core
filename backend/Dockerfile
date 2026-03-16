FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN go mod tidy && go mod download
RUN go build -o backend ./cmd

FROM alpine:3.19
WORKDIR /app
RUN apk add --no-cache tzdata
COPY --from=builder /app/backend .
ENTRYPOINT ["./backend"]
