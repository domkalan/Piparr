// TODO: update this to reflect the changes shown in epg-parser.js
// Data is not passed back and forth, instead paths are passed and will be read from disk

const { parentPort, workerData, isMainThread } = require('worker_threads');
const { parseM3U } = require("@tunarr/playlist");

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Parse HLS/M3U using the m3u parser
const m3u8 = parseM3U(workerData);

// Return the message
parentPort.postMessage({m3u8})