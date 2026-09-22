FROM node:24.11.0-bookworm-slim AS build

ENV CHATNTC_STANDALONE=true
WORKDIR /workspace

COPY . .
RUN npm ci \
    && npm run build:package \
    && npm --prefix viewer ci \
    && npm --prefix viewer run build

FROM node:24.11.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /workspace/viewer/dist/standalone/ ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
