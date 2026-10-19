# Go Trip BD - single container: Node 22 (built-in SQLite) serves the API and the static frontend.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/gotrip.db \
    TRUST_PROXY=1
WORKDIR /app
COPY package.json server.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "--no-warnings", "server.js"]
