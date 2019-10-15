import * as WebSocket from 'ws';
import * as http from 'http';
import {Subscription} from '@google-cloud/pubsub';
import {pubsub} from '@canalapp/shared';
import Client from './client/client';
import Connection from './client/connection';
import {authenticateConnection} from './client/doorman';

export class GatewayServer {
  public ready: boolean = false;
  private server: WebSocket.Server;
  private clients: Map<string, Client> = new Map();
  private scriptUpdateSub: Subscription;
  constructor(private httpServer: http.Server) {
    this.setup();
  }

  private async setup() {
    await this.configureSubscriptions();
    this.server = new WebSocket.Server({server: this.httpServer});
    this.server.on('listening', () => this.ready = true);
    this.server.on('connection', (...args) => this.onConnection(...args));
  }
  private async configureSubscriptions() {
    this.scriptUpdateSub = await pubsub.getSubscription('script-updates');
    this.scriptUpdateSub.on('message', (message) => {
      const client = message.attributes.client;
      if (this.clients.has(client)) {
        this.clients.get(client).scriptUpdate(message);
      }
    });
  }
  private async onConnection(socket: WebSocket, request: http.IncomingMessage) {
    console.log('👋 We have a connection from ' + request.connection.remoteAddress);
    const conn = new Connection(socket, request);
    try {
      const bot = await authenticateConnection(conn);
      console.log(`👋 Client ${bot.id} is connected!`);
      const client = new Client(conn, bot);
      client.on('close', () => this.cleanupConnection(client));
      this.clients.set(client.id, client);
    } catch (e) {
      // If something goes wrong, just drop the connection
      conn.kill(e);
    }
  }
  private cleanupConnection(client: Client): void {
    this.clients.delete(client.id);
  }
}

export async function startGatewayServer(server: http.Server) {
  return new GatewayServer(server);
}
