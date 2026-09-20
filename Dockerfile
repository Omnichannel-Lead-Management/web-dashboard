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
# Agents claim an escalated chat off the queue and release it back to the bot.
ARG VITE_AGENT_ESCALATION_QUEUE_ENABLED=false
ENV VITE_AGENT_ESCALATION_QUEUE_ENABLED=$VITE_AGENT_ESCALATION_QUEUE_ENABLED
# Owners edit their own business profile from Settings. Off here, on in the
# deployment compose file: an image built without it shows a read-only form.
ARG VITE_BUSINESS_PROFILE_UPDATE_ENABLED=false
ENV VITE_BUSINESS_PROFILE_UPDATE_ENABLED=$VITE_BUSINESS_PROFILE_UPDATE_ENABLED
# Tenant-wide reporting from the gateway. Off, Analytics falls back to counting
# only the records already loaded in the browser.
ARG VITE_ANALYTICS_ENABLED=false
ENV VITE_ANALYTICS_ENABLED=$VITE_ANALYTICS_ENABLED
# The bell in the header, served by the notification service.
ARG VITE_NOTIFICATION_CENTER_ENABLED=false
ENV VITE_NOTIFICATION_CENTER_ENABLED=$VITE_NOTIFICATION_CENTER_ENABLED
# The embedded web chat widget, which talks to the gateway over /ws/chat.
ARG VITE_WEB_CHAT_ENABLED=false
ENV VITE_WEB_CHAT_ENABLED=$VITE_WEB_CHAT_ENABLED
# Visitors attaching images in web chat. Needs POCKETBASE_URL on the gateway:
# without it /api/upload-image answers 503 and every attachment fails.
ARG VITE_IMAGE_ATTACHMENTS_ENABLED=false
ENV VITE_IMAGE_ATTACHMENTS_ENABLED=$VITE_IMAGE_ATTACHMENTS_ENABLED
RUN bun run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
