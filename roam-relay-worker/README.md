# roam-relay-worker

> **Optional** Cloudflare Worker that lets your Roam instance be reachable
> from the internet without running a tunnel on your machine.

Deploy this Worker on your own Cloudflare account and get:

- A stable public URL per device: `https://<your-slug>.roam.<your-domain>/`
- Your Roam-running machine only dials *outbound* to the relay (WebSocket),
  no inbound ports, no port forwarding, no IP exposure.
- One Worker serves many devices — each gets its own slug + token.

---

## What this replaces

Roam v4 by default assumes you expose localhost yourself via ngrok / Cloudflare
Tunnel / Tailscale. That works but each has setup friction. The relay Worker
here is the "batteries-included" alternative: **your own** Cloudflare domain +
a ~420 line Worker = you get your own stable `https://<slug>.roam.<domain>/`.

If ngrok/Tunnel/Tailscale is fine for you, skip this whole directory.

---

## Prerequisites

- Cloudflare account with a domain on the account
- `wrangler` CLI (comes via `npm install` in this dir)
- A device token you generate yourself (plain string, hashed server-side)

## Deploy

**1. Install + login**

```bash
cd roam-relay-worker
npm install
npx wrangler login
```

**2. Create the D1 database**

```bash
npx wrangler d1 create roam_relay
```

Copy the `database_id` it prints.

**3. Write your `wrangler.jsonc`** (copy the example, fill in your values)

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

Then edit:

- `account_id` → your Cloudflare account id
- `routes[].pattern` → replace `example.com` with your domain
- `vars.DEVICE_HOST` / `vars.PUBLIC_ROOT_HOST` → match the routes above
- `d1_databases[].database_id` → the id from step 2

**4. Apply the schema**

Locally first (optional, for `wrangler dev`):
```bash
npm run db:init
```

Then on the remote D1:
```bash
npm run db:init:remote
```

**5. Deploy**

```bash
npm run deploy
```

**6. Register a device row** (manually for now)

You need one `devices` row per Roam instance. Pick a slug and a token,
then:

```bash
# Hash the token SHA-256 first. On macOS:
echo -n "your-secret-token" | shasum -a 256

# Insert (fill in the hex from above):
npx wrangler d1 execute roam_relay --remote --command \
  "INSERT INTO devices (device_id, slug, token_hash) VALUES ('dev-1', 'myhome', '<sha256-hex>');"
```

(An admin UI to manage devices is out of scope for this directory — see the
wandesk admin project for inspiration if you want to build one.)

---

## How your Roam client connects

Roam v4 ships a relay dialer at [`server/relay/`](../server/relay). Point it
at your Worker with three env vars:

```bash
export ROAM_RELAY_WS="wss://relay.<your-domain>/ws/device"
export ROAM_RELAY_TOKEN="your-secret-token"        # plain; matched against D1 via SHA-256
export ROAM_DEVICE_ID="dev-1"                       # matches the row you inserted in D1
npm start
```

`npm start` auto-spawns a `[relay]` process alongside `[main]` and `[apps]`
whenever all three env vars are set. Each process's logs get its own prefix.
The relay:

- dials `wss://relay.<domain>/ws/device?device_id=<id>` with `Authorization: Bearer <token>`
- holds the connection open with exponential-backoff auto-reconnect
- translates `proxy_request` → `fetch('http://127.0.0.1:9507' + path)` → `proxy_response`
- tunnels `ws_open` / `ws_message` / `ws_close` frames to/from local WebSockets

Unset the three env vars to turn relay off — `npm start` reverts to just
`main + apps`.

---

## Architecture

```
 Your Mac/Linux                Cloudflare                 Any Browser
 ┌──────────────┐   wss         ┌─────────────┐   https    ┌──────────┐
 │ Roam server  │ ───────────►  │  roam-relay │ ◄──────── │  User    │
 │ (localhost)  │  outbound     │   Worker    │  inbound  │          │
 └──────────────┘  WebSocket    │  + D1 + DO  │           └──────────┘
                                 └─────────────┘
```

- Device dials `wss://relay.<domain>/ws/device`, authenticates with its
  token, and holds the WebSocket open.
- Browser hits `https://<slug>.roam.<domain>/`, the Worker looks up the slug
  in D1, finds the live WebSocket to that device, and tunnels the HTTP/WS
  request through.
- A Durable Object (`DeviceRelay`) per device coordinates the bidirectional
  framing.

## License

MIT
