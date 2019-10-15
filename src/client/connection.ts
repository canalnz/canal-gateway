import * as WebSocket from 'ws';
import * as http from 'http';
import * as EventEmitter from 'events';
import GatewayError from '../errors';

const heartbeatInterval = 5 * 1000;
const heartbeatTimeoutDuration = 11 * 1000; // Kill if two heartbeats are missed

export class Connection extends EventEmitter {
  public heartbeatTimeoutId: NodeJS.Timer | null = null;
  constructor(private socket: WebSocket, request: http.IncomingMessage) {
    super();
    this.socket.on('message', (d) => this.handleMessage(d));
    this.socket.on('close', (c, m) => this.onClose(c, m));
    this.send('HELLO', {
      heartbeat: heartbeatInterval
    });
    // Setup heartbeat timer.
    // If this isn't here, timer would never get setup if client doesn't send initial heartbeat
    this.handleHeartbeat();
  }
  public kill(error: Error|GatewayError) {
    if (!(error instanceof GatewayError)) {
      console.error('Fatal exception in connection!');
      console.dir(error);
    }
    // Coerce into a gateway error
    const gatewayErr = error instanceof GatewayError ? error : new GatewayError(4000, 'An internal error occurred');
    console.log(`Killing connection: ${gatewayErr}`);
    this.socket.close(gatewayErr.code, this.serialize(gatewayErr.payload));
  }
  public send(eventName: string, payload?: any): void {
    console.log(`> ${eventName}`);
    if (!payload) this.socket.send(this.serialize([eventName]));
    else this.socket.send(this.serialize([eventName, payload]));
  }

  private handleHeartbeat() {
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatTimeoutId = setTimeout(() => {
      this.kill(new GatewayError(4000, 'We haven\'t received a heartbeat from you in a while. Are you still alive?'));
    }, heartbeatTimeoutDuration);
  }
  private handleMessage(d: WebSocket.Data): void {
    const [eventName, payload] = this.deserialize(d);
    if (eventName === 'HEARTBEAT') this.handleHeartbeat();
    else console.log(`< ${eventName}`);
    this.emit('message', eventName, payload);
  }
  private serialize(v: any): string {
    return JSON.stringify(v);
  }
  private deserialize(v: any): any {
    return JSON.parse(v.toString());
  }
  private onClose(code: number, message: string): void {
    // Currently just bubble the event up
    if (this.heartbeatTimeoutId) clearInterval(this.heartbeatTimeoutId);
    this.emit('close', code, message);
  }
}

export default Connection;
