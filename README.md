# SeReDe - Secure *Remote-'N'-Authenticated* DevTools

**Collaborate on Bugs Using Chrome DevTools remotely over a Secure Proxy from Any Browser**

Nothing fancy folks, just a simple 
HTTPS+WebSocket Proxy Server with HTTP Basic Auth to 
expose DevTools from a browser on the machine you run it on
so you can work and collaborate, on web apps and bugs, remotely.
Connect to and debug remote tabs from any device\*.

A version of this tool was originally part of the closed-source paid version of my [secure remote browser](https://github.com/i5ik/ViewFinder), but the secure remote debugging capability proved so useful I decided to package it up, copy it out, and make it its own bona-fide open-source product for everyone to use, for free.

I searched around a bit before doing so, and while I couldn't find any current prior art that was up to date in 2021, here was some prior art that I found:

- [auchenberg/devtools-remote](https://github.com/auchenberg/devtools-remote) - Experimental HTTP and WebSocket proxy from 2016

\* This patched version of Chrome DevTools works in latest Firefox, Safari and Chrome on dekstop and mobile (as tested).

## Get it

```sh
$ npm i -g serede
## or
$ npx serede
## or
$ npm i --save serede
## or
$ git clone https://github.com/i5ik/secure-remote-devtools.git
$ cd secure-remote-devtools/
$ npm i
```

## Use it

From the command line:

```sh
serede 9222
```

Using npx:

```sh
npx serede 9222
```

From a NodeJS script:

```javascript
import serede from 'serede';

async function remoteDebug(browserPort = 9222){
  return await serede.connectBrowser(browserPort).then(startServer => startServer({
    user: 'debugging-hobgoblin',
    pass: process.env.PASSWORD
  }));
}
```

From the repository:

```sh
$ cd secure-remote-devtools/
$ npm start 9222
```

## Security

For security, ***don't expose your browser port (by default 9222) to the public internet***.

This server uses [helmet](https://github.com/helmetjs/helmet), HTTPS, and WSS (*secure WebSockets*).

**serede** uses HTTP Basic Auth and cookie authentication to prevent unauthorized connections. The need for a secure remote connection utility for DevTools is [well known](https://bugs.chromium.org/p/chromium/issues/detail?id=813540)

## Certificates

By default, serede looks for TLS certificates *(`cert.pem, chain.pem, fullchain.pem  and privkey.pem`)* in `path.resolve(os.homedir(), 'sslcerts')` *(`$HOME/sslcerts` on Windows)*. You can override that with the `certBasePath` option. 

## API 

All the options you see below can be accessed via script using their camel-cased variants. Globally installed command line usage (`npm i -g serede@latest`) is shown for demonstrative purposes. The command line API is equivalent whether you use `npx` or `npm start` from the repository to run it.

### Browser Port

The port that you have exposed the remote debugging protocol on, via the `--remote-debugging-port` Chrome command line argument. Simple the first positional argument after the command. I.e, say your browser is on port 51386, you'd start a server that is running remote DevTools with:

```sh
$ serede 51386

{serverUp: {port: 443, time: 'https://github.com/helmetjs/helmet', connected: true, browserPort: 51386}}
```

### User and Password for Basic Auth

By default serede looks in `path.resolve(os.homedir(), '.serede.access')` for the username and password credentials. The file has the following format.

`~/.serede.access`:
```txt
userNaMe:passW0rD
```

You can also pass it via environment variable `SEREDE_AUTH`, e.g.:

```sh
$ export SEREDE_AUTH=user:pass
```

Note that the values are only read on server start, and any changes you make to the environment variable or `.serede.access` file will not be reflected until you restart the server.

### Background

Run it in the background, like so:

```sh
$ serede 51386 &
```

Or using pm2:

```sh
$ pm2 start serede
```

## Server Port

By default serede runs on port 8000, but you can set this via the `SEREDE_PORT` environment variable, or via the following syntax:

```sh
$ serede 8002:51386
```

Where the argument follows the `<server_port>:<browser_port>` format.

### Technical Details and Limitations

By default the Chrome DevTools Frontend does not work cross-browser. It only works in Chrome. This is not a policy of the DevTools team, simply because they don't have the bandwidth to support this right now. 
I [opened a PR to bring cross-browser support to DevTools](https://github.com/ChromeDevTools/devtools-frontend/pull/165), but until and unless we make it happen, I am having `serede` patch the DevTools frontend resources *in-flight* via the proxy, so it can work in any browser.

Because of this ad-hoc, "off-branch" solution, and given the fact that each version of Chrome may ship with a slightly different version of the DevTools front-end, you may find it breaks at any time.

### Other disclaimers

This project has zero association, endorsement or any relationship with with Google, Chrome, the Chrome Dev team, Chrome DevTools front-end or any of the authors.

