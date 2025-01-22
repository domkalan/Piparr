const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

// resolve directories
const serverSourceDirectory = path.resolve('./server/src');
const serverSourceWorkersDirectory = path.resolve(path.join(serverSourceDirectory, 'workers'));

const serverDistDirectory = path.resolve('./dist/')
const serverDistWorkersDirectory = path.resolve(path.join(serverDistDirectory, 'workers'));

// remove workers directory if it exists, we need a fresh one
if (fs.existsSync(serverDistWorkersDirectory)) {
    rimraf.rimrafSync(serverDistWorkersDirectory)
}

// create the new directory
fs.mkdirSync(serverDistWorkersDirectory);

// get all worker files in the source
const serverSourceWorkers = fs.readdirSync(serverSourceWorkersDirectory);

// scan each worker file in the source
for(const sourceWorker of serverSourceWorkers) {
    // get the directories for this file
    const sourceFilePath = path.resolve(path.join(serverSourceWorkersDirectory, sourceWorker));
    const distFilePath = path.resolve(path.join(serverDistWorkersDirectory, sourceWorker));

    // get the file type for this file
    const sourceFileType = sourceWorker.split('.').pop();

    if (sourceFileType.endsWith('ts')) {
        // TODO: implement ts conversion for workers here

        console.error('[Build-Workers] TS conversion for workers is not supported yet, view ./scripts/build-workers for more info');

        continue;
    }

    if (sourceFileType.endsWith('js')) {
        fs.copyFileSync(sourceFilePath, distFilePath);
    }
}

console.log(`[Build-Workers] built ${serverSourceWorkers.length} worker(s)`);