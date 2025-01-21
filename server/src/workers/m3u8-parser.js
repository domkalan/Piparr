const { parentPort, workerData, isMainThread } = require('worker_threads');
const { parseM3U } = require("@tunarr/playlist");

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

const m3u8 = parseM3U(workerData);

parentPort.postMessage({m3u8})