FROM oven/bun:1.3.14
WORKDIR /app
COPY app.ts policy.ts page.ts server.ts ./
USER bun
EXPOSE 3210
CMD ["bun", "server.ts"]
