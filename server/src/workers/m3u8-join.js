// Import required modules for worker thread and XML parsing
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const readline = require('readline')

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Define input and output paths
const inputPaths = workerData.inputs;
const outputPath = workerData.output;
const streamIds = workerData.streams;

const out = fs.createWriteStream(outputPath, { encoding: "utf8" });

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

async function parseFiles(inputPath) {
    const input = fs.createReadStream(inputPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    let lastExtInf = null;

    for await (const rawLine of rl) {
        const line = rawLine.trimEnd();

        if (line.startsWith('#EXTM3U'))
            continue;

        // Parse #EXTINF
        if (line.startsWith("#EXTINF")) {
            lastExtInf = parseExtInf(line);

            // Get the tvg id
            const tvgId = lastExtInf?.attrs["tvg-id"] || "";

            // If no stream ids are supplies, just export everything i guess
            if (streamIds.includes(tvgId) || streamIds.length === 0) {
                out.write(line + "\n");
            } else {
                // set to null, will skip lines until next #EXTINF
                lastExtInf = null;
            }


            continue; // Do not write the EXTINF line yet, wait for the URL
        }

        // Handle URL following EXTINF
        if (!line.startsWith("#") && line.trim() !== "" && lastExtInf) {
            // Write the EXTINF line and the URL together if the filters matched
            out.write(line + "\n");

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
}

async function combineM3uFiles() {
    out.write('#EXTM3U\n');

    for (const inputPath of inputPaths) {
        await parseFiles(inputPath)
    }

    parentPort.postMessage({});
}

combineM3uFiles();