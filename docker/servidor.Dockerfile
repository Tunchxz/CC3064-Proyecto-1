FROM gcc:13 AS builder
WORKDIR /build
COPY Makefile .
COPY src/ src/
RUN make servidor

FROM debian:bookworm-slim
COPY --from=builder /build/servidor /usr/local/bin/servidor
EXPOSE 8080
ENTRYPOINT ["servidor"]
CMD ["8080"]
