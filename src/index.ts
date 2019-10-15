import 'reflect-metadata';
import {startGatewayServer} from './server';
import {createDbConnection} from '@canalapp/shared/dist/db';
import {pubsub} from '@canalapp/shared';
import {startHttpServer} from './http';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD as string; // This cast isn't safe, but typescript isn't noticing the guard?
const DB_PORT = +(process.env.DB_PORT || 5432);

if (!DB_PASSWORD) throw new Error('DB_PASSWORD is required!');

const port = process.env.GATEWAY_PORT || process.env.PORT || 4000;

async function main() {
  pubsub.setup();

  const conn = await createDbConnection({
    host: DB_HOST,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    port: DB_PORT
  });
  
  const server = await startGatewayServer(+port);

  // This is used by kubernetes ingress to detect liveliness
  if (process.env.NODE_ENV === 'production') {
    const httpServer = await startHttpServer(4080);
  }
}

main();
