// Import required modules for worker thread and XML parsing
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const sax = require('sax');

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Define input and output paths, language filter, and EPG remap map from worker data
const inputPath = workerData.input;
const outputPath = workerData.output;
const langFilter = workerData.filter;
const epgRemapMap = workerData.epgRemapMap

// Create SAX stream for XML parsing and file streams for input and output
const saxStream = sax.createStream(true, { trim: true });
const input = fs.createReadStream(inputPath, { encoding: "utf8" });
const output = fs.createWriteStream(outputPath, { encoding: "utf8" });

// Write the XML header to the output file
output.write('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE tv SYSTEM "xmltv.dtd">\n');

// Initialize variables for tracking current XML tags, channels, and programs
const allowedChannels = new Set();
let currentTag = null;
let currentChannel = null;
let currentProgram = null;
let buffer = "";
let includeCurrentChannel = false;

// SAX event handlers for parsing XML
saxStream.on("opentag", (node) => {
  currentTag = node.name;

  if (node.name === "channel") {
    currentChannel = { id: epgRemapMap[node.attributes.id] || node.attributes.id, displayNames: [], displayNameAttrs: [] };
    includeCurrentChannel = false;
  } else if (node.name === "programme") {
    currentProgram = { attrs: node.attributes, title: "", subtitle: "", desc: "" };
  } else if (node.name === 'display-name') {
    currentChannel.displayNameAttrs = node.attributes;
  } else if (node.name === 'tv') {
    output.write(`<tv date="${node.attributes.date}" generator-info-name="${node.attributes['generator-info-name']}" generator-info-url="${node.attributes['generator-info-url']}" source-info-name="${node.attributes['source-info-name']}" source-info-url="${node.attributes['source-info-url']}">\n`)
  }
});

saxStream.on("text", (text) => {
  if (!currentTag) return;
  buffer += text;
});

saxStream.on("closetag", (tagName) => {
  if (tagName === "display-name" && currentChannel) {
    const name = buffer.trim();
    if (name.length) {
      currentChannel.displayNames.push({ value: name });
    }

    // TODO: switch this out with proper regex
    if (langFilter !== '' && (currentChannel.displayNameAttrs.lang || '').toLowerCase().includes(langFilter.toLowerCase())) {
      includeCurrentChannel = true;
    }
  }

  if (tagName === "channel") {
    if (includeCurrentChannel) {
      allowedChannels.add(currentChannel.id);
      output.write(`  <channel id="${currentChannel.id}">\n`);
      for (const name of currentChannel.displayNames) {
        const nameScrub = name.value.replace(/&/g, '&amp;');

        output.write(`    <display-name lang="${currentChannel.displayNameAttrs.lang}">${nameScrub}</display-name>\n`);
      }
      output.write("  </channel>\n");
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
      const titleScrub = currentProgram.title.replace(/&/g, '&amp;');
      const descScrub = currentProgram.desc.replace(/&/g, '&amp;')

      output.write(`  <programme start="${currentProgram.attrs.start}" stop="${currentProgram.attrs.stop}" channel="${chID}">\n`);
      if (currentProgram.title) output.write(`    <title>${titleScrub}</title>\n`);
      if (currentProgram.desc) output.write(`    <desc>${descScrub}</desc>\n`);
      output.write("  </programme>\n");
    }
    currentProgram = null;
  }

  buffer = "";
  currentTag = null;
});

saxStream.on("end", () => {
  output.write("</tv>\n");
  output.end();

  parentPort.postMessage(workerData.output)
});

input.pipe(saxStream);
