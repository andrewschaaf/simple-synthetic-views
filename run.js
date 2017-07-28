const child_process = require('child_process');
const CDP = require('chrome-remote-interface');
const uuidv4 = require('uuid/v4');
const url = require('url');
const fs = require('fs');

function startChrome() {
  const chromeProcess = child_process.spawn('bash', [
    '-c', 'google-chrome --headless --disable-gpu --remote-debugging-port=9222'
  ]);
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(chromeProcess);
    }, 1000); // TODO detect readiness properly
  });
}

async function main() {
  const runParams = JSON.parse(process.argv[2]);
  run(runParams);
}

async function run(runParams) {
  const chromeProcess = await startChrome();
  await useChrome(runParams);
  chromeProcess.kill('SIGKILL');
}

async function useChrome(runParams) {

  const regexParamKeys = [
    'blockResourcesWhosePathnameMatches',
    'blockResourcesWhoseHostDoesNotMatch',
    'blockResourcesWhoseHostMatches',
  ]
  for (const k of regexParamKeys) {
    if (runParams[k]) {
      runParams[k] = new RegExp(runParams[k]);
    }
  }

  const viewId = uuidv4();
  const result = {
    view: {
      id: viewId,
      t: new Date().toISOString(),
      url: runParams.url,
    },
    requests: [],
  };

  var _shouldBlock = (hostname, pathname) => {
    if (runParams.blockResourcesWhosePathnameMatches) {
      if (pathname.match(runParams.blockResourcesWhosePathnameMatches)) {
        return true;
      }
    }
    if (runParams.blockResourcesWhoseHostDoesNotMatch) {
      if (!hostname.match(runParams.blockResourcesWhoseHostDoesNotMatch)) {
        return true;
      }
    }
    if (runParams.blockResourcesWhoseHostMatches) {
      if (hostname.match(runParams.blockResourcesWhoseHostMatches)) {
        return true;
      }
    }
    return false;
  };

  const requestsById = {};
  const requestIds = [];

  try {
    var client = await CDP();
    const {Network, Page, Console, Emulation} = client;

    Network.setRequestInterceptionEnabled({enabled: true});

    Network.requestIntercepted((params) => {
      const {interceptionId, request} = params;
      const {hostname, pathname} = url.parse(request.url);
      if (_shouldBlock(hostname, pathname)) {
        const errorReason = 'AccessDenied';
        Network.continueInterceptedRequest({interceptionId, errorReason});
      } else {
        Network.continueInterceptedRequest({interceptionId});
      }
    });

    Network.responseReceived((params) => {
      const {requestId, timestamp, response} = params;
      const {status, mimeType} = response;
      const {hostname, pathname} = url.parse(response.url);
      const row = {
        id: uuidv4(),
        view_id: viewId,
        url: response.url,
        hostname, pathname, status,
        mime: mimeType,
        size: 0,
      }
      requestsById[requestId] = row;
      requestIds.push(requestId);
    });

    Network.dataReceived((params) => {
      const {requestId, dataLength} = params;
      const row = requestsById[requestId];
      row.size = row.size + dataLength;
    });

    await Promise.all([
      Network.enable(),
      Page.enable(),
      Console.enable(),
    ]);

    await Network.setCacheDisabled({cacheDisabled: true});

    const width = 1100;
    const height = 3000;
    await Emulation.setDeviceMetricsOverride({
      width,
      height,
      deviceScaleFactor: 0,
      mobile: false,
      fitWindow: false
    });
    await Emulation.setVisibleSize({width, height});

    await Page.navigate({url: runParams.url});

    await Page.loadEventFired();

    await sleep(runParams.msAfterLoad || 1);

    for (const id of requestIds) {
      result.requests.push(requestsById[id]);
    }
  } catch (err) {
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      process.stdout.write(JSON.stringify(result, null, 2));
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main();
