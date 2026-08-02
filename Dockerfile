# ruletka hub — simple match + signaling bridge + static UI
#
#   docker build -t ruletka-hub .
#   docker run --rm -p 8790:8790 -v ruletka-data:/opt/ruletka/data ruletka-hub
#   # or: docker compose up --build
#
# See docs/SELF_HOST.md

FROM rust:1-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY common common
COPY bridge bridge
COPY agent agent
COPY sim sim
COPY demo demo
COPY tools tools
COPY contracts contracts
RUN cargo build -p freenet-roulette-bridge --release \
  && strip target/release/roulette-bridge

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --home /opt/ruletka --shell /usr/sbin/nologin ruletka
COPY --from=build /src/target/release/roulette-bridge /usr/local/bin/roulette-bridge
COPY ui /opt/ruletka/ui
RUN mkdir -p /opt/ruletka/data \
  && chown -R ruletka:ruletka /opt/ruletka
USER ruletka
WORKDIR /opt/ruletka
ENV ROULETTE_LISTEN=0.0.0.0:8790 \
    RUST_LOG=info
EXPOSE 8790
VOLUME ["/opt/ruletka/data"]
ENTRYPOINT ["roulette-bridge"]
CMD ["--mode", "simple", "--listen", "0.0.0.0:8790", "--ui-dir", "/opt/ruletka/ui", "--friends-file", "/opt/ruletka/data/friends.json"]
