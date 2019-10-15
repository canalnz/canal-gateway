import * as http from 'http';

export async function startHttpServer(port: number) {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/system/health') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({status: 'ok', message: 'nothing is visibly on fire!'}));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(port);
}
