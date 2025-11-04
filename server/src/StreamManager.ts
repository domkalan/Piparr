import fs from 'node:fs';
import path from 'node:path';
import Timers from 'node:timers/promises'
import { Readable } from 'node:stream';

import Piparr from ".";

import { DatabaseEngine } from "./DatabaseEngine";
import { ChannelSourceInternal, EPGRemap, EPGSource, Stream } from "./types";
import { BackgroundThreading } from './BackgroundThreading';

export default class StreamManager {
    // In memory store of channels available (is there a limit?)
    public static streams : ChannelSourceInternal[] = [];

    // Have we done the initial parsing of streams
    public static streamsParsed: boolean = false;
    // Have we done the initial parsing of epg
    public static epgParsed: boolean = false;

    public static async FetchStreams() {
        console.log(`[Piparr][StreamManager] fetching streams`);
        
        // select all streams from database
        const streams = await DatabaseEngine.AllSafe('SELECT * FROM streams;', []) as Stream[];

        // run operation with all streams
        for(const stream of streams) {
            try {
                // calc current time
                const rightNow = Math.floor(Date.now() / 1000);

                // set path where stream is stored
                const streamsOut = path.join(Piparr.dataDir, `stream-${stream.id}.m3u`);

                // Add 12 hours (of seconds) to our last update, m3u should still be the same
                if (stream.last_updated + 43200 >= rightNow && stream.healthy === 1) {
                    // have we parsed the initial array of streams?
                    if (!this.streamsParsed) {
                        console.log(`[Piparr][StreamManager] scanning ${stream.name} for initial population`);

                        await this.ParseStream(stream);

                        continue;
                    }

                    console.log(`[Piparr][StreamManager] ${stream.name} was updated in the last 12 hours, skipping`);

                    continue;
                }

                // update record in db
                await DatabaseEngine.RunSafe(`UPDATE streams SET healthy = ? WHERE id = ?`, [2, stream.id]);

                // notify will now update
                console.log(`[Piparr][StreamManager] will now update stream ${stream.name} -> ${stream.stream}`);

                // create http request
                const response = await fetch(stream.stream, {
                    method: "GET"
                });

                // ensure response body is not null
                if (!response.body) {
                    throw new Error("Response body is null");
                }

                // create a write stream to the file system
                const writeStream = fs.createWriteStream(streamsOut);

                // convert the response body to a Node.js readable stream
                const readableStream = Readable.fromWeb(response.body as any);

                // pipe the readable stream to the write stream
                readableStream.pipe(writeStream);

                // wait for the stream to finish
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });

                // notify update
                console.log(`[Piparr][StreamManager] got updated streams for ${stream.name}`);

                // await until we are done parsing
                await this.ParseStream(stream);

                // mark as healthy
                await DatabaseEngine.RunSafe(`UPDATE streams SET last_updated = ?, healthy = ? WHERE id = ?`, [rightNow, 1, stream.id]);

                // wait
                await Timers.setTimeout(1000);
            } catch(error) {
                console.warn(`[Piparr][StreamManager] failed to update ${stream.name}, will try again next task`);

                await DatabaseEngine.RunSafe(`UPDATE streams SET healthy = ? WHERE id = ?`, [0, stream.id]);

                this.ClearStreamData(stream.id);
            }
        }
    }

    public static async ParseStream(stream : Stream) : Promise<any> {
        console.log(`[Piparr][StreamManager] parsing streams for ${stream.name}`);

        // Resolve the path to the output .m3u file
        const streamsOut = path.join(Piparr.dataDir, `stream-${stream.id}.m3u`);

        // Resolve the path to the output .m3u file
        const streamsOutScrub = path.join(Piparr.dataDir, `stream-${stream.id}-scrub.m3u`);

        try {
            // Run the m3u8-parser worker script in a background thread
            const parsedData = await BackgroundThreading.RunAsync(__dirname + '/workers/m3u8-parser.js', {
                input: streamsOut,
                output: streamsOutScrub
            }, 60000) as any;

            // copy the scrubbed m3u8 to static
            const streamsOutStatic = path.resolve(path.join(`./static/stream-${stream.id}.m3u`));

            fs.copyFileSync(streamsOutScrub, streamsOutStatic);

            const newStreams: ChannelSourceInternal[] = [];

            let streamId = 0;
            // Iterate over each channel in the parsed m3u8 data
            for(const channel of parsedData.channels) {
                console.log(`[Piparr][StreamManager] stream ${stream.name} contains stream ${streamId}`)
                
                // Default stream ID and name if not provided
                const streamId_default = `stream${stream.id}.source${streamId}`;
                const streamName_default = stream.name + ' Source #' + streamId;

                // Create a stream object with the parsed data
                const streamObject = {
                    id: (channel.tvgId as any) || streamId_default,
                    name: (channel.name as any) || streamName_default,
                    stream: stream.id,
                    logo: channel.tvgLogo,
                    endpoint: channel.url as any
                }

                // Add the stream object to the newStreams array
                newStreams.push(streamObject);

                // If the stream type is 'direct', select the first stream and break the loop
                if (stream.type === 'direct') {
                    /*const urlParser = new URL(channel.url);

                    if (urlParser.pathname.endsWith('.m3u') || urlParser.pathname.endsWith('.m3u8')) {
                        // Additional logic can be added here if needed
                        streamObject.endpoint = ''
                    }*/

                    // TODO: this might not require break, look into it
                    break;
                }

                streamId++;
            }

            // have we built the initial values
            if (!this.streamsParsed)
                this.streamsParsed = true;

            console.log(`[Piparr][StreamManager] stream ${stream.name} contains ${newStreams.length} stream(s)`)

            // Update the streams array with the new streams
            this.streams = this.streams.filter(i => i.stream !== stream.id).concat(newStreams);
        } catch(error) {
            console.error(`[Piparr][StreamManager][ERROR] stream ${stream.name} failed`, error);
        }
    }

    public static async FetchEPGSources() {
        console.log(`[Piparr][StreamManager] fetching streams`);
        
        // select all streams from database
        const sources = await DatabaseEngine.AllSafe('SELECT * FROM epgsources;', []) as EPGSource[];

        // get all epg remap values
        const epgRemapValues = await DatabaseEngine.AllSafe('SELECT * FROM epgremaps;', []) as EPGRemap[];
        
        // store all of our epg remap values
        const epgRemap : { [key : string] : string } = {};

        // Loop through our epg remap values and apply them to the map
        for(const epgRemapValue of epgRemapValues) {
            console.log(`[Piparr][StreamManager] will remap ${epgRemapValue.original} -> ${epgRemapValue.new}`)

            epgRemap[String(epgRemapValue.original)] = epgRemapValue.new;
        }

        // run operation with all streams
        for(const source of sources) {
            try {
                // calc current time
                const rightNow = Math.floor(Date.now() / 1000);

                // Add 12 hours (of seconds) to our last update, m3u should still be the same
                if (source.last_updated + 86400 >= rightNow && source.healthy === 1) {
                    // have we parsed the initial array of streams?
                    if (!this.epgParsed) {
                        console.log(`[Piparr][StreamManager] scanning epg ${source.name} for initial population`);

                        await this.ParseEPG(source, epgRemap);

                        continue;
                    }

                    console.log(`[Piparr][StreamManager] epg ${source.name} was updated in the last 12 hours, skipping`);

                    continue;
                }

                // set path where stream is stored
                const streamsOut = path.join(Piparr.dataDir, `epg-${source.id}.xml`);

                // update record in db
                await DatabaseEngine.RunSafe(`UPDATE epgsources SET healthy = ? WHERE id = ?`, [2, source.id]);

                // notify will now update
                console.log(`[Piparr][StreamManager] will now update epg source ${source.name} -> ${source.epg}`);

                // create http request
                const response = await fetch(source.epg, {
                    method: "GET"
                });

                // ensure response body is not null
                if (!response.body) {
                    throw new Error("Response body is null");
                }

                // create a write stream to the file system
                const writeStream = fs.createWriteStream(streamsOut);

                // convert the response body to a Node.js readable stream
                const readableStream = Readable.fromWeb(response.body as any);

                // pipe the readable stream to the write stream
                readableStream.pipe(writeStream);

                // wait for the stream to finish
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });

                // notify update
                console.log(`[Piparr][StreamManager] got updated streams for ${source.name}`);


                // await until we are done parsing
                await this.ParseEPG(source, epgRemap);

                // mark as healthy
                await DatabaseEngine.RunSafe(`UPDATE epgsources SET last_updated = ?, healthy = ? WHERE id = ?`, [rightNow, 1, source.id]);
            } catch(error) {
                console.warn(`[Piparr][StreamManager] failed to update epg ${source.name}, will try again next task`);

                await DatabaseEngine.RunSafe(`UPDATE epgsources SET healthy = ? WHERE id = ?`, [0, source.id]);
            }
        }

        // have we built the initial values
        if (!this.epgParsed)
            this.epgParsed = true;
    }

    public static async ParseEPG(epg : EPGSource, epgRemapMap : { [key : string] : string }) {
        console.log(`[Piparr][StreamManager] parsing streams for ${epg.name}`);

        // Resolve the path to the output .xml file
        const streamsOut = path.join(Piparr.dataDir, `epg-${epg.id}.xml`);

        // Resolve the path to the scrubbed xml file
        const streamsOutScrub = path.join(Piparr.dataDir, `epg-${epg.id}-scrub.xml`);

        // Resolve the path to the output .json file
        const streamsOutJson = path.join(Piparr.dataDir, `epg-${epg.id}.json`);

        // Run the epg-parser worker script in a background thread
        await BackgroundThreading.RunAsync(__dirname + '/workers/epg-parser.js', { 
            input: streamsOut,
            output: streamsOutScrub,
            outputJson: streamsOutJson,
            filter: epg.regex,
            epgRemapMap: epgRemapMap
        }, 60000 * 5);

        console.log(`[Piparr][StreamManager] clean of epg done for ${epg.name}`);

        // path for static accessing
        const streamsOutStatic = path.resolve(path.join(`./static/epg-${epg.id}.xml`));

        fs.copyFileSync(streamsOutScrub, streamsOutStatic);

        // give the disk time to flush the write
        await Timers.setTimeout(5000);
    }

    // Remove streams from local disk
    public static ClearStreamData(id : number) {
        const streamsOut = path.join(Piparr.dataDir, `stream-${id}.m3u`);

        if (fs.existsSync(streamsOut)) {
            fs.unlinkSync(streamsOut);
        }

        const streamsOutJson = path.join(Piparr.dataDir, `stream-${id}.json`);

        if (fs.existsSync(streamsOutJson)) {
            fs.unlinkSync(streamsOutJson);
        }
    }

    public static ClearEPGData(id : number) {
        const streamsOut = path.join(Piparr.dataDir, `epg-${id}.xml`);

        if (fs.existsSync(streamsOut)) {
            fs.unlinkSync(streamsOut);
        }

        const streamsOutJson = path.join(Piparr.dataDir, `epg-${id}.json`);

        if (fs.existsSync(streamsOutJson)) {
            fs.unlinkSync(streamsOutJson);
        }
    }

    public static async MonitorStreams() {
        // fetch streams every 1 hour
        // TODO: set this as a setting
        setInterval(async () => {
            await this.FetchStreams();
        }, 3.6e+6);

        // refresh epg every 24 hours
        // TODO: set this as a setting
        setInterval(async () => {
            await this.FetchEPGSources();
        }, 8.64e+7);

        await this.FetchStreams();
        await this.FetchEPGSources();
    }
}