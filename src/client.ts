import * as EventEmitter from 'events';
import {getScriptLinkRepo, getScriptRepo, Script, Bot} from '@canalapp/shared/dist/db';
import Connection from './connection';

export type IncomingEventName = 'HEARTBEAT' | 'IDENTIFY' | 'CLIENT_STATUS_UPDATE' | 'SCRIPT_STATUS_UPDATE';
export type OutgoingEventName = 'HELLO' | 'READY' | 'SCRIPT_CREATE' | 'SCRIPT_UPDATE' | 'SCRIPT_REMOVE' | 'OPTIONS_UPDATE';

function EventHandler(event: IncomingEventName) {
  return (target: Client, propertyKey: keyof Client) => {
    target.socketEventHandlers = target.socketEventHandlers || {};
    target.socketEventHandlers[event] = propertyKey;
  };
}

export class Client extends EventEmitter {
  public socketEventHandlers: {[propName: string]: keyof Client} | undefined;
  public token: string | null = null;
  public id: string;
  constructor(private connection: Connection, public bot: Bot) {
    super();
    this.id = bot.id;
    this.connection.on('message', (e, p) => this.onMessage(e, p));
    this.connection.on('close', (c, m) => this.onClose(c, m));

    this.sendReady();
  }

  public async sendReady() {
    const scripts = await Promise.all(
      (await getScriptLinkRepo().find({botId: this.bot.id}))
        .map(async (s) => await getScriptRepo().findOne({id: s.scriptId}) as Script)
    );

    this.send('READY', {
      token: this.bot.token,
      scripts: scripts.map((s) => ({
        id: s.id,
        name: s.name,
        body: s.body,
        platform: s.platform
      }))
    });
  }
  public send(eventName: OutgoingEventName, payload?: any) {
    this.connection.send(eventName, payload);
  }

  private onMessage(eventName: string, payload: string) {
    if (eventName === 'HEARTBEAT') return; // We can ignore this, the connection handled this at a lower level
    const handlerName = this.socketEventHandlers && this.socketEventHandlers[eventName];
    if (handlerName) {
      (this[handlerName] as (d: any) => void)(payload);
    } else console.error(`🔥 Got event ${eventName} from client, but don't have a handler for it!`);
  }
  private onClose(code: number, message: string) {
    console.log(`Connection ${this.bot ? this.bot.name : 'anonymous'} has been closed: [${code}] ${message}`);
    this.emit('close');
  }
}

export default Client;
