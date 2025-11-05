// Import required modules for worker thread and XML parsing
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const readline = require('readline')

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Define input and output paths
const inputPaths = workerData.inputs;
const outputPath = workerData.output;

const out = fs.createWriteStream(outputPath, { encoding: "utf8" });

async function parseFiles(inputPath) {
    const input = fs.createReadStream(inputPath, { encoding: "utf8" });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    for await (const rawLine of rl) {
        const line = rawLine.trimEnd();

        if (line.startsWith('#EXTM3U'))
            continue;

        out.write(line + '\n');
    }
}

async function combineM3uFiles() {
    out.write('#EXTM3U\n');

    for(const inputPath of inputPaths) {
        await parseFiles(inputPath)
    }

    parentPort.postMessage({});
}

combineM3uFiles();