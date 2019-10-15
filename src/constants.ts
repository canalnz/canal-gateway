// See https://www.notion.so/Bot-Behavior-659923f6851f4ea5bb054cfa9f599e84#eff349f48b1442399a959b2cfca44aee
type Enum<T extends string> = {
  [prop in T]: T;
};

export const endpoints = {
  GATEWAY: 'ws://gateway.canal.nz',
};

export type ClientState = 'OFFLINE' | 'FAILED' | 'STARTUP' | 'ONLINE' | 'ERROR';
export const clientStates: Enum<ClientState> = {
  OFFLINE: 'OFFLINE',
  FAILED: 'FAILED',
  STARTUP: 'STARTUP',
  ONLINE: 'ONLINE',
  ERROR: 'ERROR'
};

export type ScriptState = 'STOPPED' | 'RUNNING' | 'PASSIVE' | 'ERROR';
export const scriptStates: Enum<ScriptState> = {
  STOPPED: 'STOPPED',
  RUNNING: 'RUNNING',
  PASSIVE: 'PASSIVE',
  ERROR: 'ERROR'
};

export type MessageName = 'HEARTBEAT' | 'IDENTIFY' | 'CLIENT_STATUS_UPDATE' | 'SCRIPT_STATUS_UPDATE';
export type Message = [MessageName, any];
export const messages: Enum<MessageName> = {
  HEARTBEAT: 'HEARTBEAT',
  IDENTIFY: 'IDENTIFY',
  CLIENT_STATUS_UPDATE: 'CLIENT_STATUS_UPDATE',
  SCRIPT_STATUS_UPDATE: 'SCRIPT_STATUS_UPDATE'
};

export type EventName = 'HELLO' | 'READY' | 'SCRIPT_CREATE' | 'SCRIPT_UPDATE' | 'SCRIPT_REMOVE';
export type Event = [EventName, any];
export const events: Enum<EventName> = {
  HELLO: 'HELLO',
  READY: 'READY',
  SCRIPT_CREATE: 'SCRIPT_CREATE',
  SCRIPT_UPDATE: 'SCRIPT_UPDATE',
  SCRIPT_REMOVE: 'SCRIPT_REMOVE'
};
