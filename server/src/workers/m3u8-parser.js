const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const readline = require('readline')
const url = require('url');

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

const inputPath = workerData.input;
const outputPath = workerData.output;
const idFilter = workerData.idRegex;
const idRegexp = new RegExp(idFilter, 'i');
const nameFilter = workerData.nameRegex;
const nameRegexp = new RegExp(nameFilter, 'i');
const groupFilter = workerData.groupRegex;
const groupRegexp = new RegExp(groupFilter, 'i');

const input = fs.createReadStream(inputPath, { encoding: "utf8" });
const rl = readline.createInterface({ input, crlfDelay: Infinity });
const out = fs.createWriteStream(outputPath, { encoding: "utf8" });

let wroteHeader = false;
let lastExtInf = null;
const parsedStreams = []; // <-- this will hold all parsed M3U entries

// --- Parse attributes and title from EXTINF ---
function parseExtInf(line) {
  const match = line.match(/^#EXTINF:([^,]*),(.*)$/);
  if (!match) return null;

  const duration = match[1].trim();
  const attrRegex = /([a-zA-Z0-9\-]+)="([^"]*)"/g;
  const attrs = {};
  let m;
  while ((m = attrRegex.exec(line)) !== null) {
    attrs[m[1]] = m[2];
  }

  const commaIndex = line.lastIndexOf(",");
  const title = line.slice(commaIndex + 1).trim();

  return { duration, attrs, title };
}

async function run() {
  for await (const rawLine of rl) {
    const line = rawLine.trimEnd();

    // Write header once
    if (!wroteHeader) {
      if (!line.startsWith("#EXTM3U")) {
        out.write("#EXTM3U\n");
      }
      wroteHeader = true;
    }

    // Parse #EXTINF
    if (line.startsWith("#EXTINF")) {
      lastExtInf = parseExtInf(line);

      // Apply filtering based on idRegex, nameRegex, and groupRegex
      const tvgId = lastExtInf?.attrs["tvg-id"] || "";
      const streamName = lastExtInf?.title || "";
      const groupTitle = lastExtInf?.attrs["group-title"] || "";

      if ((idFilter && !idRegexp.test(tvgId)) ||
          (nameFilter && !nameRegexp.test(streamName)) ||
          (groupFilter && !groupRegexp.test(groupTitle))) {
        lastExtInf = null; // Skip this EXTINF if it doesn't match the filters
        continue;
      }

      continue; // Do not write the EXTINF line yet, wait for the URL
    }

    // Handle URL following EXTINF
    if (!line.startsWith("#") && line.trim() !== "" && lastExtInf) {
      // Write the EXTINF line and the URL together if the filters matched
      out.write(`#EXTINF:${lastExtInf.duration},${lastExtInf.title}\n`);
      out.write(line + "\n");

      // Collect simplified info for JSON output
      parsedStreams.push({
        url: line.trim(),
        name: lastExtInf.title,
        tvgId: lastExtInf.attrs["tvg-id"] || null,
        tvgLogo: lastExtInf.attrs["tvg-logo"] || null,
        groupTitle: lastExtInf.attrs["group-title"] || null,
      });

      lastExtInf = null;
      continue;
    }

    // Pass through any other tags
    if (line.startsWith("#")) {
      // Only write non-EXTINF tags if necessary (e.g., #EXTM3U)
      if (line.startsWith("#EXTM3U")) {
        out.write(line + "\n");
      }
      continue;
    }
  }

  out.end();

  parentPort.postMessage({ channels: parsedStreams });
}

run();