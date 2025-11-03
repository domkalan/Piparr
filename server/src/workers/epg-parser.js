const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const sax = require('sax');

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

const inputPath = workerData.input;
const outputPath = workerData.output;
const langFilter = workerData.filter;
const epgRemapMap = workerData.epgRemapMap

const saxStream = sax.createStream(true, { trim: true });
const input = fs.createReadStream(inputPath, { encoding: "utf8" });
const output = fs.createWriteStream(outputPath, { encoding: "utf8" });

output.write('<?xml version="1.0" encoding="UTF-8"?>\n<tv>\n');

const allowedChannels = new Set();
let currentTag = null;
let currentChannel = null;
let currentProgram = null;
let buffer = "";
let includeCurrentChannel = false;

// SAX event handlers
saxStream.on("opentag", (node) => {
  currentTag = node.name;

  if (node.name === "channel") {
    currentChannel = { id: epgRemapMap[node.attributes.id] || node.attributes.id, displayNames: [], displayNameAttrs: [] };
    includeCurrentChannel = false;
  } else if (node.name === "programme") {
    currentProgram = { attrs: node.attributes, title: "", subtitle: "", desc: "" };
  } else if (node.name === 'display-name') {
    currentChannel.displayNameAttrs = node.attributes;
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
        output.write(`    <display-name>${name.value}</display-name>\n`);
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
      output.write(`  <programme start="${currentProgram.attrs.start}" stop="${currentProgram.attrs.stop}" channel="${chID}">\n`);
      if (currentProgram.title) output.write(`    <title>${currentProgram.title}</title>\n`);
      if (currentProgram.desc) output.write(`    <desc>${currentProgram.desc}</desc>\n`);
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
