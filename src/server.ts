import * as WebSocket from 'ws';
import Client, {OutgoingEventName} from './client';
import * as http from 'http';
import Connection from './connection';
import {authenticateConnection} from './doorman';
import {pubsub} from '@canalapp/shared';
import {Subscription} from '@google-cloud/pubsub';

export class GatewayServer {
  private server: WebSocket.Server;
  private clients: Map<string, Client> = new Map();
  private scriptUpdateSub: Subscription;
  constructor(private port: number) {
    this.server = new WebSocket.Server({port});
    this.configureSubscriptions();
    this.server.on('listening', (...args) => this.onListening(...args));
    this.server.on('connection', (...args) => this.onConnection(...args));
  }
  public sendEvent(clientId: string, eventName: OutgoingEventName, payload: any) {
    if (this.clients.has(clientId)) {
      // Just performed .has check, will exist
      (this.clients.get(clientId) as Client).send(eventName, payload);
    }
  }

  private async configureSubscriptions() {
    this.scriptUpdateSub = pubsub.topic('script-update').subscription('gateway-instance');
  }
  private onListening() {
    console.log('⚙️ Gateway is listening on port ' + this.port);
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

export async function startGatewayServer(port: number) {
  return new GatewayServer(port);
}
