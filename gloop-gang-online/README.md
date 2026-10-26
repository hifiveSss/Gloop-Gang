# GLOOP GANG — INSTANT ONLINE EDITION

A mobile-first, multiplayer arcade survival game. This edition adds **one-tap online matchmaking**, mid-game joins, friend invites, and host migration. No accounts, downloads or party codes are necessary for public multiplayer **once this Node.js app is deployed**.

## How players use it once hosted

1. Open the site's URL on iPhone, Android, tablet or PC.
2. Tap **🌐 PLAY ONLINE**. Your round starts right away. If other public rounds have room, you join an existing one. If not, you start a new open round that others can join.
3. Tap the **↗** icon in the game to share your room link. A friend opening that link immediately joins your ongoing match if space remains.
4. Keep collecting XP, picking upgrades, dashing, blasting, and earning coins for permanent buffs.

Other choices are **PLAY SOLO** (offline while installed as a PWA) and **PRIVATE PARTY** (host/guest using a shareable link or six-character code). You can continue using keyboard or phone-touch controls.

**Important:** This download is source code. It is **not currently hosted**. Someone needs to deploy it to a public Node.js host to make the PLAY ONLINE button usable over the internet.

## Run locally

Requires Node.js 18+.

```sh
node server.js
```

Open http://localhost:3000. On phones on the same LAN, open http://YOUR_COMPUTER_IP:3000 (firewall allowing inbound port 3000).

```sh
npm test
```

This verifies legacy party rooms, instant matchmaking, invites, WebSocket state transfer, host migration and solo gameplay.

## Put it online for everyone

**Render Web Service:** The root folder has `package.json` and `render.yaml`. Upload the contents of this folder to a GitHub repository (the folder itself should be the repository root). In Render, create a Node.js **Web Service** from that repository (or deploy using Blueprint from `render.yaml`). Start command: `node server.js`. No build step is required, though `npm install` is fine. The app already uses the host-provided `PORT` and `0.0.0.0`, and uses same-origin HTTPS/WSS for all player connections.

Render's free web services currently pause after 15 minutes with no requests, and need time to wake on the next visit. An always-on paid plan removes that limitation. Hosting providers may charge based on their plans/usage, so review settings before deploying.

**After deployment** you can simply share the `https://YOUR-SERVICE.onrender.com` URL with anyone. Do not put your own PC's `localhost:3000` link in an invitation.

## Game systems

- Public 1–4 player drop-in matches with no code, instant start and automatic filling of available matches
- Invite friends during an active public round via a share button and deep link
- Private lobby parties, room codes, deep-link autojoin
- Host handover for public matches when a host leaves (the latest shared state is used by the new host)
- 3-minute survival rounds, enemy waves, bosses and revives
- 15 in-round random upgrades, 4 permanent purchasable perks (5 levels each)
- Autoshot, dash, radial blast, XP gems, hearts, results and coins
- Touch joystick/buttons on phone, WASD/arrow keys with Space and E on desktop
- Saved progress on each player's own browser (`localStorage`)
- Installable progressive web app on HTTPS

## Technical limitations

This is a hobby-game architecture: the first player in each room simulates and broadcasts the game world, while a lightweight Node.js WebSocket server matches players and relays their state. Joining a mid-round public game is possible until near the end of a match. Room matchmaking operates within **one server instance**. Server redeploys/restarts reset active matches. Profiles and upgrades remain local to each browser, not cloud-synced. Competitive scaling, persistent public rankings, anticheat, account sync and global multi-instance matchmaking would require backend upgrades. Host migration keeps sessions going after a player leaves but can still show a short jump in world state.

Files: `server.js` (HTTP, WebSockets, matchmaking), `public/` (client, CSS, images, PWA), `test-server.js`, `test-matchmaking.js`, `test-game.js` and `render.yaml`.
