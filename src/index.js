import os from 'os';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import {randomFillSync} from 'crypto';
import {fileURLToPath} from 'url';

import express from 'express';
import cookieParser from 'cookie-parser';
import WebSocket from 'ws';
import compression from 'compression';

const DEBUG = {
  val: 0
};
console.log('\n');

const {version} = JSON.parse(fs.readFileSync(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), 
    '..', 
    'package.json'
  )).toString());
const COOKIENAME = `srad@${version}`;
const cookieBuf = Buffer.alloc(20);
const tokenBuf = Buffer.alloc(20);
const COOKIE = randomFillSync(cookieBuf).toString('hex');
const TOKEN = randomFillSync(tokenBuf).toString('hex');
const sleep = ms => new Promise(res => setTimeout(res, ms));
const NO_AUTH = false; // true is insecure as anyone can connect
const COOKIE_OPTS = {
  secure: true,
  httpOnly: true,
  maxAge: 345600000,
  sameSite: 'Strict'
};
const CLI = process.argv[1] === fileURLToPath(import.meta.url);

if ( CLI ) {
  if ( ! process.argv[2] || !process.argv[2].includes(':') ) {
    throw new TypeError(`Must supply: <CHROME_PORT>:<DOMAIN_NAME>:<SERVER_PORT> 
      Received only: ${process.argv[2]}
      E.g:
      $ srad 9222:example.com:8000
    `);
  }

  const [browserPort, domainOrIP, serverPort] = process.argv[2].split(':').map((x,i) => {
    if ( i % 2 == 0 ) return parseInt(x);
    return x;
  });
  
  let certificatesPath;
  if ( process.argv[3] ) {
    certificatesPath = process.argv[3];
  }

  start({
    browserPort,
    serverPort,
    domainOrIP,
    certificatesPath
  });
} else {
  // do nothing
  DEBUG.val && console.log(`srad has loaded and is ready to go.`);
}

export default async function start({browserPort, serverPort, certificatesPath, domainOrIP}) {
  if ( ! browserPort || Number.isNaN(browserPort) ) {
    throw new TypeError(`Browser Port must be a number. Got: ${browserPort}`);
  }
  if ( ! serverPort || Number.isNaN(serverPort) ) {
    throw new TypeError(`Server Port must be a number. Got: ${serverPort}`);
  }
  const CHROME_PORT = browserPort;
  const SERVER_PORT = serverPort;
  const DOMAIN = domainOrIP;
  const SSL_OPTS = {};
  certificatesPath = certificatesPath || path.resolve(os.homedir(), `sslcerts`);
  Object.assign(SSL_OPTS, {
    cert: fs.readFileSync(path.resolve(certificatesPath, `fullchain.pem`)),
    key: fs.readFileSync(path.resolve(certificatesPath, `privkey.pem`)),
    ca: fs.readFileSync(path.resolve(certificatesPath, `chain.pem`)),
  });
  DEBUG.val && console.log({
    version, COOKIENAME, CHROME_PORT, 
    SERVER_PORT, DOMAIN, COOKIE, TOKEN, CLI, SSL_OPTS
  });

  const SOCKETS = new Map();

  const app = express();
  app.use(compression());
  app.use(express.urlencoded({extended:true}));
  app.use(cookieParser());

  app.get('/login', (req, res) => {
    const {token} = req.query;
    let authorized;
    // if we are bearing a valid token set the cookie
    // so future requests will be authorized
    if ( token == TOKEN ) {
      res.cookie(COOKIENAME+SERVER_PORT, COOKIE, COOKIE_OPTS);
      authorized = true;
    } else {
      const cookie = req.cookies[COOKIENAME+SERVER_PORT];
      authorized = cookie === COOKIE || NO_AUTH;
    }
    if ( authorized ) {
      res.redirect('/');
    } else {
      res.sendStatus(401);
    }
  });
  app.post('/', (req, res) => {
    const {token} = req.body;
    let authorized;
    // if we are bearing a valid token set the cookie
    // so future requests will be authorized
    if ( token == TOKEN ) {
      res.cookie(COOKIENAME+SERVER_PORT, COOKIE, COOKIE_OPTS);
      authorized = true;
    } else {
      const cookie = req.cookies[COOKIENAME+SERVER_PORT];
      authorized = cookie === COOKIE || NO_AUTH;
    }
    if ( authorized ) {
      res.redirect('/');
    } else {
      res.sendStatus(401);
    }
  });
  app.get('/', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'index.html'));
  });
  app.get('/devtools/LICENSE.txt', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'devtools', 'LICENSE.txt'));
  });
  app.get('/devtools_login.js', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'devtools_login.js'));
  });
  app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'favicon.ico'));
  });
  app.get('/favicon.svg', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'favicon.svg'));
  });
  app.get('/favicons/favicon.ico', (req, res) => {
    res.sendFile(path.resolve('src', 'public', 'favicons', 'favicon.ico'));
  });
  app.get('*', (req, res) => {
    const cookie = req.cookies[COOKIENAME+SERVER_PORT];
    const authorized = cookie === COOKIE || NO_AUTH;

    if (authorized) {
      const resource = {
        hostname: 'localhost',
        port: CHROME_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
      };

      const InternalEndpoint = /ws=localhost/g;
      const ExternalEndpoint = `wss=${req.headers['host'].split(':')[0]}`;

      // CRDP checks that host is localhost
      req.headers['host'] = `${'localhost'}:${SERVER_PORT}`;

      const destination = http.request(resource, destinationResponse => {
        const ct = destinationResponse.headers['content-type'];
        if ( ct.includes('json') ) {
          const onData = data => Data.body += data.toString();
          const Data = {body: ''};
          destinationResponse.on('data', onData);

          destinationResponse.headers['cache-control'] = 'no-cache';

          destinationResponse.on('end', () => {
            //destinationResponse.removeListener('data', onData);
            // save responses to inspect
              /**
              fs.writeFileSync(
                path.resolve('save', `file${Math.random().toString(36)}.data`),
                body
              );
              **/

            if ( InternalEndpoint.test(Data.body) ) {
              const newVal = Data.body.replace(InternalEndpoint, ExternalEndpoint);
              // update content length
              destinationResponse.headers['content-length'] = newVal.length+'';
              DEBUG.val && console.log(destinationResponse.headers, req.url, Data.body.length);
              //res.writeHead(destinationResponse.statusCode, destinationResponse.headers);
              res.write(newVal);
              res.end();
            } else {
              res.writeHead(destinationResponse.statusCode, destinationResponse.headers);
              res.end(Data.body);
            }
          });
        } else if ( ct.includes('javascript') ) {
          const onData = data => Data.body += data.toString();
          const Data = {body: ''};
          destinationResponse.on('data', onData);

          destinationResponse.on('end', () => {
            //destinationResponse.removeListener('data', onData);
            // save responses to inspect
              /**
              fs.writeFileSync(
                path.resolve('save', `file${Math.random().toString(36)}.data`),
                body
              );
              **/

            if ( Data.body.includes('chrome://new') ) {
              let newVal = Data.body.replace(/chrome:\/\/newtab/g, 'data:text,about:blank');
              newVal = newVal.replace(/chrome:\/\/new-tab-page/g, 'data:text,about:blank');
              // update content length
              destinationResponse.headers['content-length'] = newVal.length+'';
              DEBUG.val && console.log(destinationResponse.headers, req.url, Data.body.length);
              res.writeHead(destinationResponse.statusCode, destinationResponse.headers);
              res.write(newVal);
              res.end();
            } else {
              res.writeHead(destinationResponse.statusCode, destinationResponse.headers);
              res.end(Data.body);
            }
          });
        } else {
          destinationResponse.headers['cache-control'] = 'max-age=86400';
          res.writeHead(destinationResponse.statusCode, destinationResponse.headers);
          destinationResponse.pipe(res, {end: true});
        }
      });

      req.pipe(destination, {end: true});
    } else {
      res.sendStatus(401);
    }
  });

  const server = https.createServer(SSL_OPTS, app);
  const wss = new WebSocket.Server({server});

  wss.on('connection', (ws, req) => {
    const cookie = req.headers.cookie;
    const authorized = (cookie && cookie.includes(`${COOKIENAME+SERVER_PORT}=${COOKIE}`)) || NO_AUTH;
    DEBUG.val && console.log('connect', {cookie, authorized}, req.path, req.url);
    if ( authorized ) {
      // the internal websocket to the browser (not public, remember never expose CHROME_PORT to
      // the internets! Or bad things happen!!! 0_0
      const url = `ws://localhost:${CHROME_PORT}${req.url}`;
      try {
        const crdpSocket = new WebSocket(url);
        SOCKETS.set(ws, crdpSocket);
        crdpSocket.on('open', () => {
          DEBUG.val && console.log('CRDP Socket open');
        });
        crdpSocket.on('message', msg => {
          //console.log('Browser sends us message', msg);
          ws.send(msg);
        });
        ws.on('message', msg => {
          //console.log('We send browser message');
          crdpSocket.send(msg);
        });
        ws.on('close', (code, reason) => {
          SOCKETS.delete(ws);
          crdpSocket.close(1001, 'client disconnected');
        });
        crdpSocket.on('close', (code, reason) => {
          SOCKETS.delete(ws);
          crdpSocket.close(1011, 'browser disconnected');
        });
      } catch(e) {
        console.warn('Error on websocket creation', e);
      }
    } else {
      ws.send(JSON.stringify({error:`Not authorized`}));
      ws.close();
    }
  });

  server.listen(SERVER_PORT, err => {
    if ( err ) {
      throw err;
    }
    console.log({
      serverUp: { 
        at: new Date, 
        CHROME_PORT, 
        SERVER_PORT, 
        loginUrl: `https://${DOMAIN}:${SERVER_PORT}/login?token=${TOKEN}`
      }
    });
  });
}
