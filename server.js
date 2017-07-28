const child_process = require('child_process');
const assert = require('assert');
const http = require('http');
const url = require('url');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {Pool} = require('pg');
const u = require('./util');
const config = require(process.env.HOME + '/ssv-config');
assert.equal((typeof config.api_token), 'string');

const DB_NAME = 'ssv';
const DB_USER = 'postgres';
const VIEWS_KEYS = ['id', 't', 'url'];
const REQUESTS_KEYS = ['id', 'view_id', 'url', 'hostname', 'pathname', 'status', 'mime', 'size'];

process.env.PGHOST = 'localhost';
process.env.PGUSER = 'postgres';
process.env.PGDATABASE = 'ssv';
const db = new Pool();

function main() {
  const port = 5000;
  const host = '0.0.0.0';
  const server = http.createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;
    const f = ROUTES[pathname] || u.respond404;
    f(req, res);
  });
  server.on('listening', () => {
    if (process.send) {
      process.send('ready');
    }
    console.log('listening', {host, port});
  });
  server.listen(port, host);
}

function isAuthenticated(req) {
  return req.headers['api-token'] === config.api_token;
}

function dumpTable(req, res, tableName, headerNames) {
  const sql = "SELECT * FROM " + tableName;
  u.respondWithQueryResultsTSV(req, res, sql, DB_NAME, DB_USER, headerNames);
}

const ROUTES = {

  // curl -H 'API-Token: YOUR_TOKEN' http.../api/dump/views.tsv > views.tsv
  '/api/dump/views.tsv': (req, res) => {
    if (!isAuthenticated(req)) { return u.respond403(req, res); }
    dumpTable(req, res, 'views', VIEWS_KEYS);
  },

  // curl -H 'API-Token: YOUR_TOKEN' http.../api/dump/requests.tsv > requests.tsv
  '/api/dump/requests.tsv': (req, res) => {
    if (!isAuthenticated(req)) { return u.respond403(req, res); }
    dumpTable(req, res, 'requests', REQUESTS_KEYS);
  },

  '/api/run': (req, res) => {
    if (!isAuthenticated(req)) { return u.respond403(req, res); }
    u.readFormBody(req, async (err, params) => {
      if (err) { return u.respondError(req, res, err); }

      const runParams = {
        url: params.url,
        msAfterLoad: 2000,
      };
      if (params['block-resources-whose-pathname-matches']) {
        runParams.blockResourcesWhosePathnameMatches = params['block-resources-whose-pathname-matches'];
      }
      if (params['block-resources-whose-host-does-not-match']) {
        runParams.blockResourcesWhoseHostDoesNotMatch = params['block-resources-whose-host-does-not-match'];
      }
      if (params['block-resources-whose-host-matches']) {
        runParams.blockResourcesWhoseHostMatches = params['block-resources-whose-host-matches'];
      }

      try {
        const result = await doRun(runParams);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Done.\n');
      } catch (e) {
        console.log('=============');
        console.log(e);
        console.log('');
        res.writeHead(500, {'Content-Type': 'text/plain'});
        res.end('Error\n');
      }
    });
  },

  '/api/query.tsv': (req, res) => {
    if (!isAuthenticated(req)) { return u.respond403(req, res); }
    u.readFormBody(req, (err, params) => {
      if (err) { return u.respondError(req, res, err); }
      console.log(JSON.stringify(params))
      const sql = params.q;
      u.respondWithQueryResultsTSV(req, res, sql, DB_NAME, DB_USER);
    });
  },
};

async function doRun(runParams) {
  console.log('Starting run: ' + JSON.stringify(runParams));
  const runJsPath = path.join(__dirname, 'run.js');
  const json = JSON.stringify(runParams);
  const cmd = `node ${runJsPath} '${json}'`;
  const {stdout, stderr} = await exec(cmd);
  const result = JSON.parse(stdout);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // INSERT view
    let {id, t, url} = result.view;
    await client.query(
      'INSERT INTO views (id, t, url) VALUES ($1, $2, $3)',
      [id, t, url]
    );

    // INSERT requests
    // TODO: combine requests into one SQL statement
    for (const req of result.requests) {
      let {id, view_id, url, hostname, pathname, status, mime, size} = req;
      await client.query(
        'INSERT INTO requests (id, view_id, url, hostname, pathname, status, mime, size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, view_id, url, hostname, pathname, status, mime, size]
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e
  } finally {
    client.release();
  }

  return result;
}

main();
