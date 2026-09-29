# Web Dashboard
**Port:** 5173  
**Owner:** PATHIRANA D.P.C.N. (230465J)

Production-ready mock agent console and admin interface built with Vue 3, Vite, Pinia, Vue Router, and JavaScript.

## Overview
Real-time agent console for managing leads, conversations, and analytics.

## Documentation
See [omnichannel-backend/docs](https://github.com/Omnichannel-Lead-Management/omnichannel-backend/tree/main/docs) for platform setup.

## Quick Start
```bash
bun install
bun run dev
```

Create a production bundle:

```bash
bun run build
```

## Two consoles, one bundle

This app serves two audiences from the same build and the same UI components:

| Route | Who | Session |
|---|---|---|
| `/inbox`, `/leads`, `/billing`, … | a business owner or agent | `loop-session-token`, `stores/app.js` |
| `/admin/*` | platform staff | `loop-admin-token`, `stores/admin.js` |

The two never share a credential or an API client: `services/gatewayApi.js`
talks to the tenant API, `services/adminApi.js` talks only to `/api/admin/`, and
each holds its own token under its own storage key. The gateway enforces the
same split, so an admin session cannot read a tenant's messages even if the UI
asked it to.

## Structure
- `src/components/` — Focused layout, common, inbox, leads, appointment and settings components
- `src/components/admin/` — Platform console shell, navigation and billing widgets
- `src/views/` — Route-level application screens
- `src/views/admin/` — Platform console screens (usage, pricing, invoices)
- `src/stores/` — Shared Pinia UI state and local persistence
- `src/services/` — Promise-based mock API boundary ready for backend replacement
- `src/data/` — Realistic mock business data

The demo runs without a backend. Authentication, messaging, lead updates, appointment creation, and channel setup are simulated in the browser. Replace the mock service implementations with authenticated backend API calls for production data, real message delivery, channel authorization, and durable storage.
