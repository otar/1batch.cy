/*
 * 1batch.cy · tests/server.js
 * ---------------------------------------------------------------------------
 * A small web server for the site/ folder. Only the tests use it.
 *
 * The server does the same as Cloudflare Pages:
 *   - It sends the headers from site/_headers. (For Firefox and WebKit,
 *     helpers.js leaves out one header. See OMIT there.)
 *   - It does not publish the _headers file.
 *   - For an unknown path, it sends index.html (Pages has no 404.html).
 *
 * The server listens only on 127.0.0.1, on a free port. It keeps a list of
 * the addresses (path and query) that it received. Thus a test can make sure
 * that the page sent no data.
 */

'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** Reads site/_headers. The format is the Cloudflare Pages format: a path, then indented "Name: value" lines. */
function readHeaderRules() {
  const rules = [];
  let rule = null;
  for (const line of fs.readFileSync(path.join(SITE, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rule = { pattern: line.trim(), headers: [] };
      rules.push(rule);
    } else if (rule) {
      const at = line.indexOf(':');
      rule.headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
    }
  }
  return rules;
}

/** "*" in a _headers path agrees with all characters. */
function pathMatches(pattern, urlPath) {
  const parts = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('.*')}$`).test(urlPath);
}

/** The file for a URL path, or index.html if there is no file. */
function fileFor(urlPath) {
  const file = path.join(SITE, path.normalize(urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath));
  const found = file.startsWith(SITE + path.sep) && path.basename(file) !== '_headers'
    && fs.existsSync(file) && fs.statSync(file).isFile();
  return found ? file : path.join(SITE, 'index.html');
}

/**
 * Starts the server. Gives a promise of the http.Server. server.paths: the addresses that it received.
 * omit: the names of the headers from _headers that the server does not send.
 */
function startServer({ omit = [] } = {}) {
  const rules = readHeaderRules();
  const server = http.createServer((request, response) => {
    server.paths.push(request.url);
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const file = fileFor(urlPath);
    for (const rule of rules) {
      if (!pathMatches(rule.pattern, urlPath)) continue;
      for (const [name, value] of rule.headers) {
        if (!omit.includes(name)) response.setHeader(name, value);
      }
    }
    response.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  });
  server.paths = [];
  // A WebSocket starts with an "upgrade" request. The server writes down its path and stops it.
  server.on('upgrade', (request, socket) => {
    server.paths.push(request.url);
    socket.destroy();
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

module.exports = { SITE, readHeaderRules, startServer };
