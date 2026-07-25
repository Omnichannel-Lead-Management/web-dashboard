FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ARG VITE_GATEWAY_URL=http://localhost:3000
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
RUN bun run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
