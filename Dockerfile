FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/pix/package.json packages/pix/
RUN pnpm install --frozen-lockfile --filter payzu-mcp-pix
COPY packages/pix packages/pix
RUN pnpm --filter payzu-mcp-pix build && pnpm --filter payzu-mcp-pix --prod deploy /out

FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init wget
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/remote.js"]
