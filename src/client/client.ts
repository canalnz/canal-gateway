import * as EventEmitter from 'events';
import {getScriptLinkRepo, getScriptRepo, Script, Bot} from '@canalapp/shared/dist/db';
import Connection from './connection';
import {Message} from '@google-cloud/pubsub';
import {ClientState, EventName, MessageName, ScriptState} from '../constants';

interface ClientStatusUpdate {
  state: ClientState;
  error?: Error;
}
interface ScriptStatusUpdate {
  id: string;
  state: ScriptState;
}

function EventHandler(event: MessageName) {
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
  // Called with a pubsub scriptUpdate that appears to be directed to this client
  public async scriptUpdate(message: Message) {
    const {action, script: scriptId} = JSON.parse(message.data.toString('utf8'));
    const scriptRepo = getScriptRepo();
    console.log('Oooh, a pubsub message!', action, scriptId);
    switch (action) {
      case 'CREATE':
        const createdScript = await scriptRepo.findOneOrFail({id: scriptId});
        this.send('SCRIPT_CREATE', {
          id: createdScript.id,
          name: createdScript.name,
          body: createdScript.body,
          platform: createdScript.platform
        });
        break;
      case 'UPDATE':
        const updatedScript = await scriptRepo.findOneOrFail({id: scriptId});
        this.send('SCRIPT_UPDATE', {
          id: updatedScript.id,
          name: updatedScript.name,
          body: updatedScript.body,
          platform: updatedScript.platform
        });
        break;
      case 'RESTART':
        this.send('SCRIPT_UPDATE', {id: scriptId});
        break;
      case 'REMOVE':
        this.send('SCRIPT_REMOVE', {id: scriptId});
        break;
      default:
        throw new Error('Unknown script action!');
    }
    message.ack();
  }

  @EventHandler('CLIENT_STATUS_UPDATE')
  public async clientStatusUpdate(state: ClientStatusUpdate) {

  }

  @EventHandler('SCRIPT_STATUS_UPDATE')
  public async scriptStatusUpdate(state: ScriptStatusUpdate) {

  }

  private send(eventName: EventName, payload?: any) {
    this.connection.send(eventName, payload);
  }
  private onMessage(eventName: string, payload: string) {
    if (eventName === 'HEARTBEAT') return; // We can ignore this, the connection handled this at a lower level
    const handlerName = this.socketEventHandlers && this.socketEventHandlers[eventName];
    if (handlerName) {
      (this[handlerName] as (d: any) => void)(payload);
    } else console.error(`🔥 Got message ${eventName} from client, but don't have a handler for it!`);
  }
  private onClose(code: number, message: string) {
    console.log(`Connection ${this.bot ? this.bot.name : 'anonymous'} has been closed: [${code}] ${message}`);
    this.emit('close');
  }
}

export default Client;
