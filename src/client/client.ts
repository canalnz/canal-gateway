import * as EventEmitter from 'events';
import {
  getScriptStateRepo,
  getBotStateRepo,
  getScriptLinkRepo,
  getScriptRepo,
  Script,
  Bot
} from '@canalapp/shared/dist/db';
import Connection from './connection';
import {Message} from '@google-cloud/pubsub';
import {ClientState, clientStates, EventName, MessageName, ScriptState, scriptStates} from '../constants';
import GatewayError from '../errors';

interface ClientStatusUpdate {
  state: ClientState;
  error?: string;
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
  public terminated: boolean = false;
  public scripts: Map<string, Script> = new Map();
  constructor(private connection: Connection, public bot: Bot) {
    super();
    this.id = bot.id;
    this.connection.on('message', (e, p) => this.onMessage(e, p));
    this.connection.on('close', (c, m) => this.onClose(c, m));

    this.setState({state: clientStates.STARTUP});
    this.sendReady();
  }

  public async close(err: GatewayError) {
    // TODO: Is there a situation where this could be called in an OK condition?
    this.terminated = true;
    this.connection.kill(err);
    await this.setState({state: clientStates.FAILED, error: err.toString()});
  }
  public async sendReady() {
    const links = await getScriptLinkRepo().find({botId: this.bot.id});
    const scripts = await Promise.all(links.map(
      async (s) => await getScriptRepo().findOne({id: s.scriptId}) as Script
    ));
    scripts.forEach((s) => this.scripts.set(s.id, s));

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
        this.scripts.set(scriptId, createdScript);
        this.send('SCRIPT_CREATE', {
          id: createdScript.id,
          name: createdScript.name,
          body: createdScript.body,
          platform: createdScript.platform
        });
        break;
      case 'UPDATE':
        const updatedScript = await scriptRepo.findOneOrFail({id: scriptId});
        this.scripts.set(scriptId, updatedScript);
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
        this.scripts.delete(scriptId);
        this.send('SCRIPT_REMOVE', {id: scriptId});
        break;
      default:
        throw new Error('Received an scriptUpdate that isn\'t recognised: ' + action);
    }
  }

  @EventHandler('CLIENT_STATUS_UPDATE')
  public async clientStatusUpdate(state: ClientStatusUpdate) {
    if (!state.state) return this.close(new GatewayError(4001, 'Invalid payload: missing state on CLIENT_STATUS_UPDATE'));
    await this.setState(state);
  }

  @EventHandler('SCRIPT_STATUS_UPDATE')
  public async scriptStatusUpdate(state: ScriptStatusUpdate) {
    if (!state.state) return this.close(new GatewayError(4001, 'Invalid payload: missing state on SCRIPT_STATUS_UPDATE'));
    if (!state.id) return this.close(new GatewayError(4001, 'Invalid payload: missing id on SCRIPT_STATUS_UPDATE'));
    await this.setScriptState(state);
  }

  private async setState(state: ClientStatusUpdate) {
    await getBotStateRepo().setState({
      botId: this.id,
      state: state.state,
      error: state.error || null
    });
  }
  private async setScriptState(state: ScriptStatusUpdate) {
    await getScriptStateRepo().setState({
      botId: this.id,
      scriptId: state.id,
      state: state.state
    });
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
    if (!this.terminated) {
      if (code === 1000) {
        this.setState({state: clientStates.OFFLINE});
      } else {
        this.setState({state: clientStates.FAILED, error: new GatewayError(code, message).toString()});
      }
    }
    this.scripts.forEach((s) => this.setScriptState({id: s.id, state: scriptStates.STOPPED}));
    this.emit('close');
  }
}

export default Client;
