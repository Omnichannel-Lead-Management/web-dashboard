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

## Structure
- `src/components/` — Focused layout, common, inbox, leads, appointment and settings components
- `src/views/` — Route-level application screens
- `src/stores/` — Shared Pinia UI state and local persistence
- `src/services/` — Promise-based mock API boundary ready for backend replacement
- `src/data/` — Realistic mock business data

The demo runs without a backend. Authentication, messaging, lead updates, appointment creation, and channel setup are simulated in the browser. Replace the mock service implementations with authenticated backend API calls for production data, real message delivery, channel authorization, and durable storage.
