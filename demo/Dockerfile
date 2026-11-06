FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4
RUN apt-get update -qq && apt-get install -y --no-install-recommends git ca-certificates ffmpeg >/dev/null && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
