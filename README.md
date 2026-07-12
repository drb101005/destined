# Adaptive Low-Bandwidth Communication Platform

Phase 0 scaffolding for a browser-based one-to-one communication app that keeps a call alive even on weak or unstable networks.

## Repo Layout

```text
/
  client/   React + Vite frontend
  server/   Express + Socket.IO signaling server
```

## Requirements

- Node.js 22+
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start both apps:

```bash
npm run dev
```

3. Open the frontend in your browser:

```text
http://localhost:5173
```

## Scripts

- `npm run dev` - run client and server together
- `npm run build` - build the Vite client
- `npm run start` - start the server only

## Architecture

```text
Browser
  |
  | Socket.IO client
  v
Vite dev server :5173  <---->  Express + Socket.IO server :3001
                                   |
                                   | GET /health
                                   v
                                 health ok
```

## Phase 0 Acceptance

- `GET /health` responds from the server
- the client opens a Socket.IO connection and logs `connected` in the browser console

