import { client } from 'gas-react';

/**
 * Calls a server route and returns a promise.
 * @param {string} route - The route name registered via server.on()
 * @param {object} body  - The payload (becomes req.body on the server)
 * @returns {Promise<any>} The value returned by the route handler
 */
export default function gasClient(route, body = {}) {
  return client.send(route, body);
}
