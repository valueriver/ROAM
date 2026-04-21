import { handleRelayRequest, DeviceRelay } from './relay.js';

export default {
  async fetch(request, env) {
    const response = await handleRelayRequest(request, env);
    if (response) return response;
    return new Response('Not Found', { status: 404 });
  }
};

export { DeviceRelay };
