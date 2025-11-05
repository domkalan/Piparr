// Import required modules for worker thread and XML parsing
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const sax = require('sax');

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Define input and output paths
const inputPaths = workerData.inputs;
const outputPath = workerData.output;
const streamChannels = workerData.streamChannels;

const writtenChannels = new Set();
const outputData = { channels: [], programmes: [] }

// function
function parseEPGFile(inputPath) {
    return new Promise((resolve, reject) => {
        // Create SAX stream for XML parsing and file streams for input and output
        const saxStream = sax.createStream(true, { trim: true });
        const input = fs.createReadStream(inputPath, { encoding: "utf8" });

        // Initialize variables for tracking current XML tags, channels, and programs
        const allowedChannels = new Set();
        let currentTag = null;
        let currentChannel = null;
        let currentProgram = null;
        let currentNode = null;
        let buffer = "";
        let includeCurrentChannel = false;

        // SAX event handlers for parsing XML
        saxStream.on("opentag", (node) => {
            currentTag = node.name;

            if (node.name === "channel") {
                currentChannel = { 
                    id: node.attributes.id,
                    displayNames: [],
                    displayIcons: []
                };

                // check if the included channel is on the roster
                if (streamChannels.includes(node.attributes.id)) {
                    includeCurrentChannel = true;
                } else {
                    includeCurrentChannel = false;
                }
            } else if (node.name === "programme") {
                currentProgram = { 
                    attrs: node.attributes,
                    title: "",
                    subtitle: "",
                    desc: ""
                };
            }

            currentNode = node;
        });

        saxStream.on("text", (text) => {
            if (!currentTag) return;
            buffer += text;
        });

        saxStream.on("closetag", (tagName) => {
            if (tagName === "display-name" && currentChannel) {
                // trim the name
                const name = buffer.trim().replace(/&/g, '&amp;');

                // create base object for name
                let displayName = { value: null, lang: null };

                if (name.length) {
                    displayName.value = name;

                    // does the display name have a lang value set?
                    if (currentNode.attributes.lang) {
                        displayName.lang = currentNode.attributes.lang;
                    }

                    currentChannel.displayNames.push(displayName);
                }
            }

            // get the channel icon
            if (tagName === 'icon' && currentChannel) {
                if (currentNode.attributes.icon) {
                    this.currentChannel.displayIcons.push(currentNode.attributes.icon);
                }
            }

            if (tagName === "channel") {
                if (includeCurrentChannel) {
                    allowedChannels.add(currentChannel.id);

                    outputData.channels.push(currentChannel);
                }

                currentChannel = null;
            }

            if (tagName === "title" && currentProgram) {
                currentProgram.title = buffer.trim();
            }
            if (tagName === "desc" && currentProgram) {
                currentProgram.desc = buffer.trim();
            }

            if (tagName === "programme") {
                const chID = currentProgram.attrs.channel;
                if (allowedChannels.has(chID)) {
                    outputData.programmes.push(currentProgram);
                }

                currentProgram = null;
            }

            buffer = "";
            currentTag = null;
        });

        saxStream.on("end", () => {
            resolve();
        });

        input.pipe(saxStream);
    })
}

function writeCombinedEPG() {
    const output = fs.createWriteStream(outputPath);

    // Write the XML header to the output file
    output.write('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE tv SYSTEM "xmltv.dtd">\n');
    // Write the opening TV bracket
    output.write('<tv source-info-url="https://github.com/domkalan/piparr" source-info-name="Piparr" generator-info-name="Piparr" generator-info-url="https://github.com/domkalan/piparr">\n')

    for(const channel of outputData.channels) {
        // save the channel id to see and compare later what we combined
        writtenChannels.add(channel.id);

        output.write(`  <channel id="${channel.id}">\n`);

        for(const displayName of channel.displayNames) {
            output.write(`    <display-name`);

            if (displayName.lang) {
            output.write(` lang="${displayName.lang}"`)
            }

            output.write(`>${displayName.value}</display-name>\n`)
        }

        for(const icon of channel.displayIcons) {
            output.write(`    <icon src="${icon}" />`);
        }

        output.write('  </channel>\n');
    }

    for(const programme of outputData.programmes) {
        const titleScrub = programme.title.replace(/&/g, '&amp;');
        const descScrub = programme.desc.replace(/&/g, '&amp;')

        output.write(`  <programme start="${programme.attrs.start}" stop="${programme.attrs.stop}" channel="${programme.attrs.channel}">\n`);
        if (programme.title) output.write(`    <title>${titleScrub}</title>\n`);
        if (programme.desc) output.write(`    <desc>${descScrub}</desc>\n`);
        output.write("  </programme>\n");
    }

    output.write('</tv>')
    output.end();
}

async function parseEPGFiles() {
    for(const inputPath of inputPaths) {
        await parseEPGFile(inputPath);
    }

    await writeCombinedEPG();

    // display what was missed
    for(const streamChannel of streamChannels) {
        if (writtenChannels.has(streamChannel)) {
            console.log(`[Piparr][StreamManager][WORKER][EPG-Join] ✅ Channel ${streamChannel} has been written to the combined guide.`);

            continue;
        }

        console.log(`[Piparr][StreamManager][WORKER][EPG-Join] ❌ Channel ${streamChannel} was not written to the combined guide, no epg data found.`)
    }

    parentPort.postMessage({})
}

parseEPGFiles();