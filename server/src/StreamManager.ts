import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { parseM3U } from "@tunarr/playlist";
import { parseXmltv, XmltvChannel } from '@iptv/xmltv';

import moment from 'moment';

import Piparr from ".";

import { DatabaseEngine } from "./DatabaseEngine";
import { ChannelSourceInternal, EpgInternal, Stream } from "./types";
import { Timers } from './Timers';
import { BackgroundThreading } from './BackgroundThreading';

export default class StreamManager {
    public static streams : ChannelSourceInternal[] = [];
    public static epg: EpgInternal[] = [];

    public static async FetchStreams() {
        console.log(`[Piparr][StreamManager] fetching streams`);
        
        // select all streams from database
        const streams = await DatabaseEngine.All('SELECT * FROM streams WHERE healthy = 1;') as Stream[];

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
            const streamsOut = path.resolve(Piparr.dataDir, `${stream.id}.m3u`);

            // check if stream has been checked and that file exists
            if (expiredTime.isBefore(lastUpdated) && fs.existsSync(streamsOut)) {
                console.log(`[Piparr][StreamManager] stream ${stream.name} was updated recently, will reparse from disk`);

                // await until we are done parsing
                try {
                    await this.ParseStream(stream);
                } catch(error) {
                    console.warn(`[Piparr][StreamManager] failed to parse ${stream.name}, will try again next task`);

                    await DatabaseEngine.Run(`UPDATE streams SET healthy = 0 WHERE id = ${stream.id}`);

                    this.ClearStreamData(stream.id);
                }

                continue;
            }

            try {
                // update record in db
                await DatabaseEngine.Run(`UPDATE streams SET last_updated = "${rightNow.toISOString()}" and healthy = 2 WHERE id = ${stream.id}`);

                // notify will now update
                console.log(`[Piparr][StreamManager] will now update stream ${stream.name}`);

                // create http request
                const response = await fetch(stream.stream, {
                    method: "GET"
                });

                // get text from request
                const body = await response.text();

                // write stream to file system
                fs.writeFileSync(streamsOut, body);

                // notify update
                console.log(`[Piparr][StreamManager] got updated streams for ${stream.name}`);

                // await until we are done parsing
                await this.ParseStream(stream);

                // mark as healthy
                await DatabaseEngine.Run(`UPDATE streams SET healthy = 1 WHERE id = ${stream.id}`);

                // wait
                Timers.WaitFor(1000)
            } catch(error) {
                console.warn(`[Piparr][StreamManager] failed to update ${stream.name}, will try again next task`);

                await DatabaseEngine.Run(`UPDATE streams SET healthy = 0 WHERE id = ${stream.id}`);

                this.ClearStreamData(stream.id);
            }
        }
    }

    public static async GrabEPG(stream : Stream) {
        debugger;
        /*console.log(`[Piparr][StreamManager] grabbing epg for stream ${stream.name}`);

        // set path where epg is stored
        const epgOut = path.resolve(Piparr.dataDir, `${stream.id}-epg.xml`);

        // create http request
        const response = await fetch(stream.epg, {
            method: "GET"
        });

        // get text from request
        const body = await response.text();

        // write stream to file system
        fs.writeFileSync(epgOut, body);

        return true;*/
    }

    public static async ParseEPG(stream : Stream) {
        debugger;
        /*console.log(`[Piparr][StreamManager] parsing epg for ${stream.name}`)

        const epgOut = path.resolve(Piparr.dataDir, `${stream.id}-epg.xml`);

        const epgFile = fs.readFileSync(epgOut).toString();

        const epgParsed = parseXmltv(epgFile);

        const epgOutJson = path.resolve(Piparr.dataDir, `${stream.id}-epg.json`);

        fs.writeFileSync(epgOutJson, JSON.stringify(epgParsed, null, 4));

        const epgUpdated: EpgInternal[] = [];

        epgUpdated.push({
            stream: stream.id, epg: epgParsed
        });

        this.epg = this.epg.filter(i => i.stream !== stream.id).concat(epgUpdated);

        console.log(`[Piparr][StreamManager] grabbing epg for stream ${stream.name} returned ${(epgParsed.channels || []).length} channel(s)`)*/
    }

    public static ParseStream(stream : Stream) : Promise<any> {
        return new Promise((resolve, reject) => {
            console.log(`[Piparr][StreamManager] parsing streams for ${stream.name}`);

            // Resolve the path to the output .m3u file
            const streamsOut = path.resolve(Piparr.dataDir, `${stream.id}.m3u`);

            // Read the content of the .m3u file
            const streamFile = fs.readFileSync(streamsOut);

            // Resolve the path to the output .json file
            const streamsOutJson = path.resolve(Piparr.dataDir, `${stream.id}.json`);

            // Run the m3u8-parser worker script in a background thread
            BackgroundThreading.Run(__dirname + '/workers/m3u8-parser.js', streamFile.toString(), (error, data) => {
                if (error !== null) {
                    console.error(`[Piparr][StreamManager][ERROR] stream ${stream.name} failed`, error);

                    // Reject the promise if an error occurs
                    reject(error);

                    return;
                }

                // Write the parsed data to the .json file
                fs.writeFileSync(streamsOutJson, JSON.stringify(data.m3u8, null, 4));

                const newStreams: ChannelSourceInternal[] = [];

                let streamId = 0;
                // Iterate over each channel in the parsed m3u8 data
                for(const channel of data.m3u8.channels) {
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

                // Resolve the promise indicating success
                resolve(true);
            }, 60000); // Timeout for the background thread
        })
    }

    // Remove streams from local disk
    public static ClearStreamData(id : number) {
        const streamsOut = path.resolve(Piparr.dataDir, `${id}.m3u`);

        if (fs.existsSync(streamsOut)) {
            fs.unlinkSync(streamsOut);
        }

        
        const streamsOutJson = path.resolve(Piparr.dataDir, `${id}.json`);

        if (fs.existsSync(streamsOutJson)) {
            fs.unlinkSync(streamsOutJson);
        }
    }

    public static async MonitorStreams() {
        // fetch streams every 1 hour
        setInterval(() => {
            this.FetchStreams();
        }, 3.6e+6);

        await this.FetchStreams();
    }
}