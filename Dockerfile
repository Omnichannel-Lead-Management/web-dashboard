FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ARG VITE_GATEWAY_URL=http://localhost:3000
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
# Bind this build to an existing tenant. Without VITE_BUSINESS_ID a first-time
# sign-in registers a new (empty) business instead of attaching to the real one.
ARG VITE_BUSINESS_ID=
ARG VITE_BUSINESS_NAME=
ARG VITE_BUSINESS_SECTOR=
ARG VITE_BUSINESS_EMAIL=
ENV VITE_BUSINESS_ID=$VITE_BUSINESS_ID
ENV VITE_BUSINESS_NAME=$VITE_BUSINESS_NAME
ENV VITE_BUSINESS_SECTOR=$VITE_BUSINESS_SECTOR
ENV VITE_BUSINESS_EMAIL=$VITE_BUSINESS_EMAIL
RUN bun run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
