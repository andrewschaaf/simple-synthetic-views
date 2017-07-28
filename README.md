## SSV: Simple Synthetic Views

A simple VM for running synthetic views.

### Status: hacky proof-of-concept, on its way to something better


### API Overview
    /api/run              with {url, ...optional params...} via formdata
    /api/query.tsv        with {q} via formdata
    /api/dump/views.tsv
    /api/dump/requests.tsv


### System Overview
    VM (Ubuntu 16.04 LTS)
      chrome        (headless)
      postgres      (listening on localhost only)
      server:   node /vagrant/server.js
        runner:   node /vagrant/run.js (invoked by the server)
        conf:     /home/ubuntu/ssv-conf.js


### Schema
    views       id, t, url
    requests    id, view_id, url, hostname, pathname, status, mime, size


### API Examples
    curl -H 'API-Token: YOUR_TOKEN' http://localhost:5000/api/dump/views.tsv
    curl -H 'API-Token: YOUR_TOKEN' http://localhost:5000/api/dump/requests.tsv

    curl \
      -H 'API-Token: YOUR_TOKEN' \
      -F "url=https://..." \
      -F "block-resources-whose-host-does-not-match=FOO|BAR" \
      -F "block-resources-whose-host-matches=ASDF" \
      -F "block-resources-whose-pathname-matches=/t.gif" \
      http://localhost:5000/api/run

    curl \
      -H 'API-Token: YOUR_TOKEN' \
      -F "q=SELECT COUNT(*) FROM views" \
      http://localhost:5000/api/query.tsv > report.tsv


### Running a batch of URLs, two at a time

1. put a list of URLs on the VM
2. `cat urls.txt | parallel -j 2 'curl ... -F "url={}" .../api/run'`


### Setting it up
With a fresh 64-bit Ubuntu 16.04 LTS (Xenial) box:

- SSH into it
- `curl https://github.com/andrewschaaf/simple-synthetic-views/archive/master.zip > simple-synthetic-views.zip`
- `unzip simple-synthetic-views.zip`
- `sudo mv simple-synthetic-views /vagrant`
- `bash /vagrant/bootstrap.sh`


### Getting a postgres console on the VM
    psql -U postgres ssv


### Example query: large images

    SELECT DISTINCT r.size AS image_size, r.url AS image_url, v.url AS page_url
      FROM requests AS r
      JOIN views AS v ON r.view_id = v.id
      WHERE (r.mime LIKE 'image/%') AND (size > 100000)
      ORDER BY r.size DESC


### License: MIT
