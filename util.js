const child_process = require('child_process');
const Busboy = require('Busboy');

function respond404(req, res) {
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('404: Not Found\n');
}

function respond403(req, res) {
  res.writeHead(403, {'Content-Type': 'text/plain'});
  res.end('403: Not Authorized\n');
}

function respondError(req, res, err) {
  res.writeHead(500, {'Content-Type': 'text/plain'});
  res.end('500: Internal Error');
}

function respondWithQueryResultsTSV(req, res, sql, dbname, dbuser, headerNames) {
  res.writeHead(200, {'Content-Type': 'text/tab-separated-values'});
  if (headerNames) {
    res.write(headerNames.join('\t') + '\n');
  }
  const p = child_process.spawn('/usr/bin/psql', [
    dbname,
    '-U', dbuser,
    '-F', '\t',
    '--tuples-only',
    '--no-align',
    '-c', sql
  ]);
  p.stdout.pipe(res);
}

function readFormBody(req, callback) {
  const result = {};
  const busboy = new Busboy({headers: req.headers});
  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    const bufs = [];
    file.on('data', (data) => { bufs.push(data); });
    file.on('end', () => {
      result[fieldname] = Buffer.concat(bufs);
    });
  });
  busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
    result[fieldname] = val;
  });
  busboy.on('finish', function() {
    callback(null, result);
  });
  req.pipe(busboy);
  // TODO error handling!
}

module.exports = {
  respond404,
  respond403,
  respondError,
  respondWithQueryResultsTSV,
  readFormBody,
};
