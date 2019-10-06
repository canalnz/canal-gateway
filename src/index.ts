import 'reflect-metadata';
import {startGatewayServer} from './server';
import {createDbConnection} from '@canalapp/shared/dist/db';
import {pubsub} from '@canalapp/shared';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USERNAME = process.env.DB_USERNAME || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD as string; // This cast isn't safe, but typescript isn't noticing the guard?
const DB_PORT = +(process.env.DB_PORT || 5432);

const port = process.env.GATEWAY_PORT || process.env.PORT || 4000;

async function main() {
  pubsub.setup('canaldev');
  // This is a separate process. We need to instantiate the DB again
  const conn = await createDbConnection({
    host: DB_HOST,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    port: DB_PORT
  });
  const server = await startGatewayServer(+port);
}

main();
