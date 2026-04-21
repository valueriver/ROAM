import { json } from './utils/http.js';
import { getRemoteDeviceBySlug, getRemoteDeviceByTokenHash, updateRemoteDevice } from './repository/remote-device.js';

const HTTP_TIMEOUT_MS = 30_000;
const encoder = new TextEncoder();

function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

function subdomainFromHost(host, rootHost) {
  const normalizedHost = normalizeHost(host);
  const normalizedRoot = normalizeHost(rootHost);
  if (!normalizedHost || !normalizedRoot) return null;
  if (normalizedHost === normalizedRoot) return null;
  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) return null;
  return normalizedHost.slice(0, -1 * (normalizedRoot.length + 1)) || null;
}

function isWebSocketUpgrade(request) {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

function mapHeaders(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    if (!out[key]) out[key] = [];
    out[key].push(value);
  }
  return out;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function sanitizeDeviceId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || null;
}

export function sanitizeSlug(value) {
  return sanitizeDeviceId(value);
}

export function buildRelayUrls(env, slug) {
  const deviceHost = normalizeHost(env.DEVICE_HOST || 'relay.example.com');
  const publicRootHost = normalizeHost(env.PUBLIC_ROOT_HOST || 'roam.example.com');
  return {
    wsUrl: `wss://${deviceHost}/ws/device`,
    publicUrl: `https://${slug}.${publicRootHost}/`
  };
}

export async function hashToken(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function deviceStub(env, slug) {
  return env.DEVICE_RELAY.get(env.DEVICE_RELAY.idFromName(slug));
}

function makeProxyRequest(request, extraHeaders = {}) {
  const headers = new Headers(request.headers);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Request(request, { headers });
}

async function authorizeBrowserAccess(env, slug) {
  const device = await getRemoteDeviceBySlug(env.DB, slug);
  if (!device) {
    return json({ success: false, message: 'device not found' }, 404);
  }
  return { device };
}

async function authorizeDeviceSocket(request, env) {
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  const token = bearer || new URL(request.url).searchParams.get('token') || '';
  const deviceId = sanitizeDeviceId(new URL(request.url).searchParams.get('device_id'));

  if (!token || !deviceId) {
    return json({ success: false, message: 'missing token or device_id' }, 400);
  }

  const device = await getRemoteDeviceByTokenHash(env.DB, await hashToken(token));
  if (!device) {
    return json({ success: false, message: 'unauthorized' }, 401);
  }
  if (device.device_id !== deviceId) {
    return json({ success: false, message: 'device mismatch' }, 403);
  }

  await updateRemoteDevice(env.DB, device.device_id, {
    last_seen_at: new Date().toISOString()
  });
  return device;
}

export async function handleRelayRequest(request, env) {
  const url = new URL(request.url);
  const host = normalizeHost(request.headers.get('host') || url.host);
  const deviceHost = normalizeHost(env.DEVICE_HOST || 'relay.example.com');
  const publicRootHost = normalizeHost(env.PUBLIC_ROOT_HOST || 'roam.example.com');

  if (host === deviceHost) {
    if (url.pathname === '/' || url.pathname === '') {
      return json({
        success: true,
        service: 'roam-relay',
        device_host: deviceHost,
        public_root_host: publicRootHost,
        routes: ['/healthz', '/ws/device', `https://{slug}.${publicRootHost}/...`]
      });
    }

    if (url.pathname === '/healthz') {
      return json({
        success: true,
        service: 'roam-relay',
        device_host: deviceHost,
        public_root_host: publicRootHost,
        time: new Date().toISOString()
      });
    }

    if (url.pathname === '/ws/device') {
      if (!isWebSocketUpgrade(request)) {
        return json({ success: false, message: 'websocket upgrade required' }, 426);
      }
      const device = await authorizeDeviceSocket(request, env);
      if (device instanceof Response) return device;
      return deviceStub(env, device.slug).fetch(
        makeProxyRequest(request, {
          'x-relay-role': 'device',
          'x-device-id': device.device_id,
          'x-device-slug': device.slug
        })
      );
    }

    return json({ success: false, message: 'not found' }, 404);
  }

  const slug = subdomainFromHost(host, publicRootHost);
  if (!slug) {
    return null;
  }

  const auth = await authorizeBrowserAccess(env, slug);
  if (auth instanceof Response) return auth;

  if (isWebSocketUpgrade(request)) {
    return deviceStub(env, auth.device.slug).fetch(
      makeProxyRequest(request, {
        'x-relay-role': 'browser-ws',
        'x-device-id': auth.device.device_id,
        'x-device-slug': auth.device.slug,
        'x-relay-path': `${url.pathname}${url.search}`,
        'x-relay-host': host
      })
    );
  }

  return deviceStub(env, auth.device.slug).fetch(
    makeProxyRequest(request, {
      'x-relay-role': 'browser-http',
      'x-device-id': auth.device.device_id,
      'x-device-slug': auth.device.slug,
      'x-relay-path': `${url.pathname}${url.search}`,
      'x-relay-host': host
    })
  );
}

export class DeviceRelay {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.deviceSocket = null;
    this.browserSockets = new Map();
    this.pendingHttp = new Map();

    for (const ws of this.state.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (!meta) continue;
      if (meta.role === 'device') {
        this.deviceSocket = ws;
      } else if (meta.role === 'browser-ws') {
        this.browserSockets.set(meta.streamId, ws);
      }
    }
  }

  async fetch(request) {
    const role = request.headers.get('x-relay-role');

    if (role === 'device' && isWebSocketUpgrade(request)) {
      return this.acceptDeviceSocket();
    }
    if (role === 'browser-ws' && isWebSocketUpgrade(request)) {
      return this.acceptBrowserSocket(request);
    }
    if (role === 'browser-http') {
      return this.handleBrowserHttp(request);
    }

    return json({ success: false, message: 'unsupported relay request' }, 400);
  }

  async acceptDeviceSocket() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.deviceSocket) {
      try {
        this.deviceSocket.close(1012, 'replaced');
      } catch {}
    }

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ role: 'device' });
    this.deviceSocket = server;

    return new Response(null, { status: 101, webSocket: client });
  }

  async acceptBrowserSocket(request) {
    if (!this.deviceSocket) {
      return new Response('device offline', { status: 502 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const streamId = crypto.randomUUID();
    const path = request.headers.get('x-relay-path') || '/';

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ role: 'browser-ws', streamId });
    this.browserSockets.set(streamId, server);

    this.sendToDevice({
      type: 'ws_open',
      stream_id: streamId,
      path,
      headers: mapHeaders(request.headers)
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleBrowserHttp(request) {
    if (!this.deviceSocket) {
      return new Response('device offline', { status: 502 });
    }

    const requestId = crypto.randomUUID();
    const path = request.headers.get('x-relay-path') || '/';
    const body = await request.arrayBuffer();
    const timeoutMs = Number(this.env.HTTP_TIMEOUT_MS || HTTP_TIMEOUT_MS);

    const responsePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingHttp.delete(requestId);
        resolve(new Response('device response timeout', { status: 504 }));
      }, timeoutMs);

      this.pendingHttp.set(requestId, {
        resolve: (payload) => {
          clearTimeout(timeout);
          const headers = new Headers();
          for (const [key, values] of Object.entries(payload.headers || {})) {
            for (const value of values) headers.append(key, value);
          }
          resolve(
            new Response(base64ToUint8Array(payload.body_base64 || ''), {
              status: payload.status || 502,
              headers
            })
          );
        }
      });
    });

    this.sendToDevice({
      type: 'proxy_request',
      request_id: requestId,
      method: request.method,
      path,
      headers: mapHeaders(request.headers),
      body_base64: arrayBufferToBase64(body)
    });

    return responsePromise;
  }

  webSocketMessage(ws, message) {
    const meta = ws.deserializeAttachment();
    if (!meta) return;

    if (meta.role === 'device') {
      this.handleDeviceMessage(message);
      return;
    }

    if (meta.role === 'browser-ws') {
      const payload =
        typeof message === 'string'
          ? { text: message, binary: false }
          : { data_base64: arrayBufferToBase64(message), binary: true };

      this.sendToDevice({
        type: 'ws_message',
        stream_id: meta.streamId,
        ...payload
      });
    }
  }

  webSocketClose(ws) {
    const meta = ws.deserializeAttachment();
    if (!meta) return;

    if (meta.role === 'device') {
      this.deviceSocket = null;
      for (const browserSocket of this.browserSockets.values()) {
        try {
          browserSocket.close(1011, 'device offline');
        } catch {}
      }
      this.browserSockets.clear();
      return;
    }

    if (meta.role === 'browser-ws') {
      this.browserSockets.delete(meta.streamId);
      this.sendToDevice({
        type: 'ws_close',
        stream_id: meta.streamId
      });
    }
  }

  handleDeviceMessage(message) {
    let payload;
    try {
      payload = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }

    if (payload.type === 'proxy_response' && payload.request_id) {
      const pending = this.pendingHttp.get(payload.request_id);
      if (pending) {
        this.pendingHttp.delete(payload.request_id);
        pending.resolve(payload);
      }
      return;
    }

    if (payload.type === 'ws_message' && payload.stream_id) {
      const browserSocket = this.browserSockets.get(payload.stream_id);
      if (!browserSocket) return;
      try {
        if (payload.binary) {
          browserSocket.send(base64ToUint8Array(payload.data_base64 || ''));
        } else {
          browserSocket.send(payload.text || '');
        }
      } catch {}
      return;
    }

    if (payload.type === 'ws_close' && payload.stream_id) {
      const browserSocket = this.browserSockets.get(payload.stream_id);
      if (!browserSocket) return;
      this.browserSockets.delete(payload.stream_id);
      try {
        browserSocket.close(1000, 'closed');
      } catch {}
    }
  }

  sendToDevice(payload) {
    if (!this.deviceSocket) {
      throw new Error('device offline');
    }
    this.deviceSocket.send(JSON.stringify(payload));
  }
}
