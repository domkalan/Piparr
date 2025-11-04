import fs from 'node:fs';
import path from 'node:path';
import Timers from 'node:timers/promises'
import { Readable } from 'node:stream';

import moment from 'moment';

import Piparr from ".";

import { DatabaseEngine } from "./DatabaseEngine";
import { ChannelSourceInternal, EPGRemap, EPGSource, Stream } from "./types";
import { BackgroundThreading } from './BackgroundThreading';

export default class StreamManager {
    public static streams : ChannelSourceInternal[] = [];

    public static async FetchStreams() {
        console.log(`[Piparr][StreamManager] fetching streams`);
        
        // select all streams from database
        const streams = await DatabaseEngine.AllSafe('SELECT * FROM streams;', []) as Stream[];

        // run operation with all streams
        for(const stream of streams) {
            // calc current time
            const rightNow = new Date(Date.now());
            const expiredTime = moment(rightNow).subtract(6, 'hour');

            // create default date
            let lastUpdated = new Date(0);
            
            // if date exists, update date
            if (typeof stream.last_updated !== 'undefined')
                lastUpdated = new Date(stream.last_updated);

            // set path where stream is stored
            const streamsOut = path.join(Piparr.dataDir, `stream-${stream.id}.m3u`);

            // check if stream has been checked and that file exists
            if (stream.healthy === 1 && expiredTime.isBefore(lastUpdated) && fs.existsSync(streamsOut)) {
                console.log(`[Piparr][StreamManager] stream ${stream.name} was updated recently, will reparse from disk`);

                // await until we are done parsing
                try {
                    await this.ParseStream(stream);
                } catch(error) {
                    console.warn(`[Piparr][StreamManager] failed to parse ${stream.name}, will try again next task`);

                    await DatabaseEngine.RunSafe(`UPDATE streams SET healthy = ? WHERE id = ?`, [0, stream.id]);

                    this.ClearStreamData(stream.id);
                }

                continue;
            }

            try {
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
                await DatabaseEngine.RunSafe(`UPDATE streams SET last_updated = ?, healthy = ? WHERE id = ?`, [rightNow.toISOString(), 1, stream.id]);

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
            // calc current time
            const rightNow = new Date(Date.now());
            const expiredTime = moment(rightNow).subtract(23, 'hour');

            // create default date
            let lastUpdated = new Date(0);
            
            // if date exists, update date
            if (typeof source.last_updated !== 'undefined')
                lastUpdated = new Date(source.last_updated);

            // set path where stream is stored
            const streamsOut = path.join(Piparr.dataDir, `epg-${source.id}.xml`);

            // check if stream has been checked and that file exists
            if (expiredTime.isBefore(lastUpdated) && fs.existsSync(streamsOut)) {
                console.log(`[Piparr][StreamManager] epg source ${source.name} was updated recently, skipping for now`);

                continue;
            }

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

            try {
                // await until we are done parsing
                await this.ParseEPG(source, epgRemap);

                // mark as healthy
                await DatabaseEngine.RunSafe(`UPDATE epgsources SET last_updated = ?, healthy = ? WHERE id = ?`, [rightNow.toISOString(), 1, source.id]);
            } catch(error) {
                console.warn(`[Piparr][StreamManager] failed to update epg ${source.name}, will try again next task`);

                await DatabaseEngine.RunSafe(`UPDATE epgsources SET healthy = ? WHERE id = ?`, [0, source.id]);
            }

            // wait
            await Timers.setTimeout(1000);
        }
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
        setInterval(async () => {
            await this.FetchStreams();
        }, 3.6e+6);

        // refresh epg every 6 hours
        setInterval(async () => {
            await this.FetchEPGSources();
        }, 2.16e+7);

        await this.FetchStreams();
        await this.FetchEPGSources();
    }
}