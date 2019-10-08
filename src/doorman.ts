import Connection from './connection';
import GatewayError from './errors';
import {Bot, getBotRepo} from '@canalapp/shared/dist/db';

const authTimeout = 5 * 1000; // Client must send identify within this duration

export function authenticateConnection(connection: Connection): Promise<Bot> {
  /* Hello, and welcome to Async Hell! First up: async function within a promise constructor! */
  /* Act 2: Custom resolve logic! */
  return new Promise((resolve, reject) => {
    const authTimer = setTimeout(() => {
      reject(new GatewayError(4009, 'You took too long to send an identify payload'));
    }, authTimeout);
    // Yikes, fuck this.
    const done = (success: boolean, ...args: any[]): void => {
      clearTimeout(authTimer);
      connection.removeListener('message', handler);
      if (success) resolve(...args);
      else reject(...args);
    };
    const handler = async (eventName: string, payload: any) => {
      if (eventName === 'IDENTIFY') {
        try {
          const bot = await handleIdentify(payload);
          done(true, bot);
        } catch (e) {
          done(false, e);
        }
      } else done(false, new GatewayError(4003, 'You must authenticate before sending a payload'));
    };
    connection.once('message', handler);
  });
}
async function handleIdentify(payload: {token: string, client_info: any}): Promise<Bot> {
  if (!payload.token) throw new GatewayError(4001, 'token is required for identify!');

  const bot = await getBotRepo().findOne({apiKey: payload.token}) || null;
  if (!bot) throw new GatewayError(4004, 'We failed to authenticate you');
  // Beep boop, they're now authenticated!
  return bot;
}
