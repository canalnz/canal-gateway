import {createDbConnection} from '@canalapp/shared/dist/db';
import {startGatewayServer} from './server';
import {pubsub} from '@canalapp/shared';
import * as http from 'http';

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

  // All of this annoying code is because GKE requires a health check running on the same port as the service
  const server = http.createServer((req, res) => {
    if (req.url === '/system/health') {
      const body = JSON.stringify({status: 'ok', message: 'nothing is visibly on fire!'});

      res.writeHead(200, {
        'Content-Length': body.length,
        'Content-Type': 'application/json'
      });
      res.end(body);
    } else {
      const body = http.STATUS_CODES[426];

      res.writeHead(426, {
        'Content-Length': body.length,
        'Content-Type': 'text/plain'
      });
      res.end(body);
    }
  });
  const wsServer = await startGatewayServer(server);

  server.listen(+port);
  console.log('⚙️ Gateway is listening on port ' + port);
}

main();
