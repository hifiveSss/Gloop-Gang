# GLOOP GANG: RIFT RUMBLE

Version 2.0 — A fresh, mobile-first *real-time strategy* game, replacing the survival/shooter game.

## Just play

Once hosted, share the website address (for example `https://gloop-gang.onrender.com`). Play on Android, iPhone, tablet or computer without an account or download.

* **Battle Online** matches you with a human opponent in the queue. If there is no human opponent within ~8.5 seconds, you get a clearly-labelled bot battle instead.
* **Play With a Friend** generates a private link. Your friend just opens the link and the game starts — no account, manually entered codes, or lobby setup needed.
* **VS Bot** starts immediately. When disconnected from the server, it falls back to local offline practice.

Drag a card onto the battlefield, or select a card and tap a valid location. Troops/buildings must go on your half of the arena; spells can target anywhere. PC: press number keys 1–4 to select cards.

## Rules

Two lanes, two side towers and one protected core per player. 8-card deck, 4-card rotating hand. Troops advance automatically and attack. Spells affect a marked area. A card costs between 2 and 6 GOO. GOO regenerates over time, doubles near the end, and regenerates faster for controlling the two rifts on the bridges.

Destroy an enemy side tower to make their core vulnerable; destroying their core wins instantly. If time runs out after 2 minutes 45 seconds, surviving towers and their remaining health determine the winner.

Earn coins and trophies after battles, unlock new cards by trophy milestones and spend coins to level up your favourites. Stats and progression are saved in that browser's local storage (NOT across phones, clearing the browser will erase them). 15 cards: troops, splash attackers, towers, healers, fast attackers, tanks, area damage, slow and speed boosts. All visuals are custom-drawn with Canvas; no game engine or external assets required.

## Update your EXISTING website on Render

Your current GitHub repository (from the earlier setup) has a folder named `gloop-gang-online`, and your existing Render Web Service points its **Root Directory** there.

**To replace the old survival game and keep the same URL:**

1. Unzip the new ZIP file. It contains a replacement folder also named `gloop-gang-online`.
2. On your GitHub repository, open the existing `gloop-gang-online` folder, then use **Add file → Upload files** to upload the new folder's CONTENTS (including `server.js`, `package.json`, `public/index.html`, `public/style.css`, `public/app.js`, `public/core.js`, etc.) **into that same folder**. Commit the changes. GitHub's web upload may require dragging the `public` folder; ensure that its files are inside `gloop-gang-online/public/` after committing.
3. In Render, leave **Root Directory = `gloop-gang-online`**. Language Node, build command `npm install`, start command `node server.js`. On an existing service, Render normally auto-deploys a new commit; if not, use **Manual Deploy → Deploy latest commit**.
4. Wait for Render **Live**, open your old website address and refresh. If the old game still appears, hard refresh (Ctrl+Shift+R on desktop), or clear site cache on mobile. The service worker uses a new cache version.

Alternatively, if you upload everything at the GitHub repository root, set Root Directory in Render to blank. The `package.json`, `server.js` and `public` folder must all be in the same root directory.

**Important:** This ZIP cannot update GitHub or Render on its own. Upload and commit the updated code to put the new game on the live website. The existing Render plan may go idle after inactivity; when it wakes, matching resumes, and an in-progress match can disconnect if the host restarts or redeploys.

## Run locally

Requires Node.js 18+. There are **no third-party npm dependencies**.

```sh
npm install
npm start
```

Open http://localhost:3000 and use two browser tabs/devices to play together. Run `npm test` to verify simulation, HTTP, online matchmaking, friend joining and result delivery.

## File layout

`server.js` — HTTP/WebSocket server, authoritative game loop, private invites, quick-match queue, bot fallback.

`public/core.js` — shared rules/AI, cards, energy, unit movement and combat.

`public/app.js` — mobile/desktop inputs, game screens, Canvas renderer, UI and stored progression.

`public/style.css` — responsive interface.

`public/sw.js`, `manifest.webmanifest`, `icon.svg` — installable PWA and offline assets for local practice.

`test.js` — server/game integration tests.

## Limitations and improvements

The current game is a playable small-scale game, not a production esports backend. Rooms and matchmaking exist only in the memory of one Render service instance; updates restart them. There is no cloud save or user account, and the server trusts a player's supplied deck/progression (not suitable for real-money competitions). Friend links work for one live two-player match at a time. Queue matchmaking groups users on the same server; after ~8.5 seconds of waiting, it starts a bot game. Multiplayer requires an online WebSocket connection. There is no paid content, chat or public ranking service.
