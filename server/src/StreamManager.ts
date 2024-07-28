import fs from 'node:fs';
import path from 'node:path';

import { parseM3U } from "@tunarr/playlist";
import { parseXmltv, XmltvChannel } from '@iptv/xmltv';

import moment from 'moment';

import Piparr from ".";

import { DatabaseEngine } from "./DatabaseEngine";
import { ChannelSourceInternal, EpgInternal, Provider } from "./types";
import { Timers } from './Timers';

export default class StreamManager {
    public static streams : ChannelSourceInternal[] = [];
    public static epg: EpgInternal[] = [];

    public static async FetchStreams() {
        console.log(`[Piparr][StreamManager] fetching streams`);
        
        // select all providers from database
        const providers = await DatabaseEngine.All('SELECT * FROM providers;') as Provider[];

        // run operation with all providers
        for(const provider of providers) {

            // calc current time
            const rightNow = new Date(Date.now());
            const expiredTime = moment(rightNow).subtract(6, 'hour');

            // create default date
            let lastUpdated = new Date(0);
            
            // if date exists, update date
            if (typeof provider.last_updated !== 'undefined')
                lastUpdated = new Date(provider.last_updated);

            // set path where stream is stored
            const streamsOut = path.resolve(Piparr.dataDir, `${provider.id}.m3u`);

            // check if stream has been checked and that file exists
            if (expiredTime.isBefore(lastUpdated) && fs.existsSync(streamsOut)) {
                console.log(`[Piparr][StreamManager] stream ${provider.name} was updated recently, skipping`);

                // await until we are done parsing
                await this.ParseStream(provider);

                // await until parse epg
                await this.ParseEPG(provider);

                continue;
            }

            try {
                // notify will now update
                console.log(`[Piparr][StreamManager] will now update stream ${provider.name}`);

                // create http request
                const response = await fetch(provider.stream, {
                    method: "GET"
                });

                // get text from request
                const body = await response.text();

                // write stream to file system
                fs.writeFileSync(streamsOut, body);

                // notify update
                console.log(`[Piparr][StreamManager] got updated streams for ${provider.name}`);

                // await until we are done parsing
                await this.ParseStream(provider);

                // update record in db
                await DatabaseEngine.Run(`UPDATE providers SET last_updated = "${rightNow.toISOString()}" WHERE id = ${provider.id}`);

                // grab epg
                await this.GrabEPG(provider);

                // parse epg
                await this.ParseEPG(provider);

                // wait some time before next stream
                await Timers.WaitFor(5000);
            } catch(error) {
                console.warn(`[Piparr][StreamManager] failed to update ${provider.name}, will try again next task`);
            }
        }
    }

    public static async GrabEPG(provider : Provider) {
        console.log(`[Piparr][StreamManager] grabbing epg for provider ${provider.name}`)

        // set path where epg is stored
        const epgOut = path.resolve(Piparr.dataDir, `${provider.id}-epg.xml`);

        // create http request
        const response = await fetch(provider.epg, {
            method: "GET"
        });

        // get text from request
        const body = await response.text();

        // write stream to file system
        fs.writeFileSync(epgOut, body);
    }

    public static async ParseEPG(provider : Provider) {
        console.log(`[Piparr][StreamManager] parsing epg for ${provider.name}`)

        const epgOut = path.resolve(Piparr.dataDir, `${provider.id}-epg.xml`);

        const epgFile = fs.readFileSync(epgOut).toString();

        const epgParsed = parseXmltv(epgFile);

        const epgOutJson = path.resolve(Piparr.dataDir, `${provider.id}-epg.json`);

        fs.writeFileSync(epgOutJson, JSON.stringify(epgParsed, null, 4));

        const epgUpdated: EpgInternal[] = [];

        epgUpdated.push({
            provider: provider.id, epg: epgParsed
        });

        this.epg = this.epg.filter(i => i.provider !== provider.id).concat(epgUpdated);

        console.log(`[Piparr][StreamManager] grabbing epg for provider ${provider.name} returned ${(epgParsed.channels || []).length} channel(s)`)
    }

    public static async ParseStream(provider : Provider) {
        console.log(`[Piparr][StreamManager] parsing streams for ${provider.name}`);

        const streamsOut = path.resolve(Piparr.dataDir, `${provider.id}.m3u`);

        const streamFile = fs.readFileSync(streamsOut);

        const m3u8 = parseM3U(streamFile.toString());

        const streamsOutJson = path.resolve(Piparr.dataDir, `${provider.id}.json`);

        fs.writeFileSync(streamsOutJson, JSON.stringify(m3u8, null, 4));

        const newStreams: ChannelSourceInternal[] = [];

        for(const channel of m3u8.channels) {
            newStreams.push({
                id: channel.tvgId as any,
                name: channel.name as any,
                provider: provider.id,
                logo: channel.tvgLogo,
                
                endpoint: channel.url as any
            });
        }

        console.log(`[Piparr][StreamManager] provider ${provider.name} contains ${newStreams.length} stream(s)`)

        this.streams = this.streams.filter(i => i.provider !== provider.id).concat(newStreams)
    }

    public static async MonitorStreams() {
        await this.FetchStreams();

        // fetch streams every 1 hour
        setTimeout(() => {
            this.FetchStreams();
        }, 3.6e+6);
    }
}