# Adaptive Low-Bandwidth Communication Platform

A browser-based one-to-one calling app that degrades gracefully when the network gets bad. Audio is prioritized over video, and the UI always shows what the adaptive engine is doing.

## Repo Layout

```text
/
  client/   React + Vite frontend
  server/   Express + Socket.IO signaling server
```

## Scripts

- `npm run dev` - start client and server together for development
- `npm run build` - build the client
- `npm run start` - start the server
- `npm run call` - build the client and start the server in local-laptop mode
- `npm run test` - run the adaptive logic tests

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env files and adjust values if needed:

- `client/.env.example`
- `server/.env.example`

3. Run the app in development:

```bash
npm run dev
```

4. Open the app in the browser and enter:

- a signaling server URL
- a room code
- the optional room password

## Architecture

```text
Browser A                           Browser B
   |                                    |
   | Socket.IO signaling + chat         | Socket.IO signaling + chat
   v                                    v
                 Express + Socket.IO server
                 /health + room relay + fallback text
                           |
                           | WebRTC offer/answer + ICE
                           v
                     Peer-to-peer media
```

## Environment Variables

### Client

- `VITE_SERVER_URL` - default signaling server URL
- `VITE_TURN_SERVER_URL` - optional TURN server URL
- `VITE_TURN_USERNAME` - optional TURN username
- `VITE_TURN_CREDENTIAL` - optional TURN credential

### Server

- `PORT` - server port, default `3001`
- `CLIENT_ORIGIN` - allowed frontend origin
- `ROOM_SECRET` - optional shared secret for room access
- `SERVE_CLIENT` - set to `false` to disable static frontend serving

## Start a Call

For the local-laptop flow described in the build prompt:

1. `npm run call`
2. `cloudflared tunnel --url http://localhost:3001`
3. Share the tunnel URL with your contact
4. Both people enter the same room code and join
5. Stop the server and tunnel when done

## Notes

- The app uses native WebRTC APIs directly.
- The adaptive engine is covered by unit tests in `client/src/adaptive/__tests__/decision.test.js`.
- The stats overlay shows live connection and quality values, including RTT, packet loss, bitrate, ICE candidate type, and the current adaptive tier.
- Noise suppression, echo cancellation, and auto gain control are enabled by default, with an in-app toggle for noise suppression.
- TURN is optional and should be provided through environment variables if cross-network direct P2P fails because of symmetric NAT.

