// Import required modules for worker thread and XML parsing
const { parentPort, workerData, isMainThread } = require('worker_threads');
const fs = require('fs');
const sax = require('sax');

if (isMainThread)
    throw new Error('Cannot run from main thread, this is a background task!');

// Define input and output paths, language filter, and EPG remap map from worker data
const inputPath = workerData.input;
const outputPath = workerData.output;
const langFilter = workerData.langRegex;
const langRegexp = new RegExp(langFilter, 'i');
const nameFilter = workerData.nameRegex;
const nameRegexp = new RegExp(nameFilter, 'i');
const idFilter = workerData.idRegex;
const idRegexp = new RegExp(idFilter, 'i');
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
let currentNode = null;
let buffer = "";
let includeCurrentChannel = false;

// SAX event handlers for parsing XML
saxStream.on("opentag", (node) => {
  currentTag = node.name;

  if (node.name === "channel") {
    currentChannel = { 
      id: epgRemapMap[node.attributes.id] || node.attributes.id,
      displayNames: [],
      displayIcons: []
    };

    // if no filters are set, we should include by default
    if (idFilter === '' && nameFilter === '' && langFilter === '') {
      includeCurrentChannel = true;
    } else {
      // reset value to false
      includeCurrentChannel = false;
    }
  } else if (node.name === "programme") {
    currentProgram = { 
      attrs: node.attributes,
      title: "",
      subtitle: "",
      desc: ""
    };
  } else if (node.name === 'tv') {
    output.write(`<tv`);

    if (node.attributes.date) {
      output.write(` date="${node.attributes.date}"`);
    }

    if (node.attributes['generator-info-name']) {
      output.write(` generator-info-name="${node.attributes['generator-info-name']}"`);
    }

    if (node.attributes['generator-info-url']) {
      output.write(` generator-info-url="${node.attributes['generator-info-url']}"`);
    }

    if (node.attributes['source-info-name']) {
      output.write(` source-info-name="${node.attributes['source-info-name']}"`);
    }

    if (node.attributes['source-info-url']) {
      output.write(` source-info-url="${node.attributes['source-info-url']}"`);
    }

    output.write(`>\n`);
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

    // Allow for filtering based on display name's defined language
    // If filter is set to EN, only channels with display language of "EN" will be passed
    if (langFilter !== '' && displayName.lang !== null) {
      if (langRegexp.test(displayName.lang)) {
        includeCurrentChannel = true;
      }
    }

    // Filter based on channel names, if filter is set to ACME247
    // Only channels with ACME247 in the name will be passed
    if (nameFilter !== '') {
      if (nameRegexp.test(name)) {
        includeCurrentChannel = true;
      }
    }
  }

  // get the channel icon
  if (tagName === 'icon' && currentChannel) {
    if (currentNode.attributes.icon) {
      this.currentChannel.displayIcons.push(currentNode.attributes.icon);
    }
  }

  if (tagName === "channel") {
    // Filter out based on channel ids, if filter is set to .us
    // Only channels with .us in their id will be passed
    if (idFilter !== '') {
      if (idRegexp.test(currentChannel.id)) {
        includeCurrentChannel = true;
      }
    }

    if (includeCurrentChannel) {
      allowedChannels.add(currentChannel.id);
      output.write(`  <channel id="${currentChannel.id}">\n`);

      // write channel display names
      for (const name of currentChannel.displayNames) {
        output.write(`    <display-name`);

        if (name.lang) {
          output.write(` lang="${name.lang}"`)
        }

        output.write(`>${name.value}</display-name>\n`)
      }

      // write icons
      for(const icon of currentChannel.displayIcons) {
        output.write(`    <icon src="${icon}" />`);
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

  parentPort.postMessage({})
});

input.pipe(saxStream);
