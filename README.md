# Go Trip BD - online bus ticketing for Bangladesh

Search buses across all 64 districts, pick seats on a live seat map, pay, and get an e-ticket with a PNR.
Same flow as a rail e-ticket portal (search -> trips -> seat selection -> timed hold -> payment -> ticket -> cancel/refund), built for buses.

**Stack:** Node.js 22 (no npm dependencies) - built-in SQLite database - vanilla JS single-page frontend, all served by one process.

## Features
- 21 operators (Hanif, Shyamoli, Green Line, Ena, S.R. Travels, Saintmartin, Soudia, National, Shohagh, Desh, Nabil, Royal, TR, Unique, Eagle, Konok, NS, Ruposhi Bangla, Sakura, Tisha, BRTC), 64 districts, 318 routes, ~12,000 weekly-repeating schedules
- Categories: **Non-AC, AC, Business Class, AC Sleeper, Double Decker AC** (fare = distance x category rate)
- Search with filters (bus type, time of day, operator), sorting, previous/next day
- Seat map per bus layout, boarding/dropping points, max 4 seats, 10-minute seat hold, auto-expiry
- Register/login (scrypt password hashing, signed tokens), My Tickets, cancel with tiered refund, print ticket
- Verify ticket (PNR + mobile), fare chart, operators, notices, FAQ, contact form, terms/refund policy
- Admin panel (stats, bookings, messages) for the admin account

> **Demo project.** Routes, timings, fares and counters are generated sample data, and operator names are used for illustration only.
>
> **Payments are a working sandbox, not real.** bKash, Nagad, Rocket, Upay and card all run a realistic multi-step flow
> (account/card details -> one-time code -> PIN -> confirmation), but nothing connects to any wallet or bank and no money moves.
> The one-time code is shown on screen instead of being sent by SMS, the PIN is only format-checked (never stored or logged), and the
> sandbox deliberately uses neutral styling rather than copying any provider's branding. Use made-up numbers; test card `4242 4242 4242 4242`, any future expiry, any CVV.
> To take real payments later, replace the `/pay/start` and `/pay` handlers in `src/api.js` with a licensed gateway (e.g. SSLCommerz, bKash, Nagad merchant APIs).

## Run locally
```bash
node -v            # needs 22.13+
npm start          # http://localhost:3000  (database is created and seeded on first start)
npm test           # 19 end-to-end checks on a throwaway database
```
Copy `.env.example` to `.env` to set an admin account: `ADMIN_PHONE=017XXXXXXXX`, `ADMIN_PASSWORD=...` (8+ chars), then log in and open the Admin link.

## Configuration (environment variables)
| Variable | Purpose |
|---|---|
| `JWT_SECRET` | **Required in production.** Long random string (`openssl rand -hex 32`). |
| `DB_PATH` | SQLite file location. Must be on persistent storage (`/data/gotrip.db`). |
| `ADMIN_PHONE`, `ADMIN_PASSWORD` | Creates/updates the admin account at boot. |
| `TRUST_PROXY=1` | Set when behind a load balancer (Render, Fly, Nginx). |
| `PUBLIC_URL` | Public site URL for verify links. |
| `HOLD_MINUTES` | Seat hold time (default 10). |
| `DEMO_SOLD=0` | Turn off the random pre-sold demo seats. |

## Deploy

SQLite is a file, so the host **must give you a persistent disk/volume**, and you must run **one instance**.

### Option A - Render (easiest, Docker)
1. Push this folder to a GitHub repo.
2. Render -> New -> Blueprint -> pick the repo (uses `render.yaml`; creates a 1 GB disk at `/data`; disks need a paid plan).
3. Fill in `ADMIN_PHONE` and `ADMIN_PASSWORD` when prompted. `JWT_SECRET` is generated for you.
4. Add your domain under Settings -> Custom Domains.

### Option B - Fly.io
```bash
fly launch --no-deploy --copy-config
fly volumes create gotrip_data --size 1 --region sin
fly secrets set JWT_SECRET=$(openssl rand -hex 32) ADMIN_PHONE=017XXXXXXXX ADMIN_PASSWORD='your-password'
fly deploy
```

### Option C - Any VPS (DigitalOcean, Hetzner, etc.)
```bash
docker build -t go-trip-bd .
docker run -d --name gotrip --restart unless-stopped -p 3000:3000 -v gotrip_data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) -e ADMIN_PHONE=017XXXXXXXX -e ADMIN_PASSWORD='your-password' \
  go-trip-bd
```
Put Nginx or Caddy in front for HTTPS (e.g. Caddy: `yourdomain.com { reverse_proxy localhost:3000 }`), and set `TRUST_PROXY=1`.
Without Docker: install Node 22, `git clone`, set the env vars, run `node server.js` under `systemd` or `pm2`.

### Backups
Copy `/data/gotrip.db` (plus the `-wal`/`-shm` files if present) regularly, or run `sqlite3 gotrip.db ".backup backup.db"`.

## Project layout
```
server.js          boot: seed, admin account, HTTP server, expiry sweeper
src/db.js          schema (users, districts, operators, categories, routes, schedules, bookings, booking_seats, payments, notices, faqs, messages)
src/data.js        districts, operators, categories, boarding points
src/seed.js        generates routes and schedules
src/api.js         all /api endpoints
src/auth.js        password hashing + tokens
src/http.js        tiny router, security headers, static files, rate limiting
public/            frontend (index.html, css/, js/ with one file per page)
scripts/           reset-db.js, smoke-test.js
```
