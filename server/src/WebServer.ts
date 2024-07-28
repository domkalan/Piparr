import path from 'node:path';
import fs from 'node:fs';

import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import { parseXmltv, writeXmltv, XmltvChannel, XmltvProgramme } from '@iptv/xmltv';

import { Advertise } from "./Advertise";
import StreamManager from "./StreamManager";
import { DatabaseEngine } from './DatabaseEngine';
import { Channel, ChannelSource, EpgBuilder } from './types';

export default class WebServer {
    public static Run() {
        const fastify = Fastify({
            logger: true
        });

        fastify.register(FastifyStatic, {
            root: path.resolve('./static'),
            prefix: '/static/',
        });

        fastify.get('/', (req, res) => {
            res.redirect('/web/index.html', 302);
        });

        fastify.get('/web/index.html', (req, res) => {
            const viewsPath = path.resolve(path.join('./views', 'web.html'));
            const webAppFile = fs.readFileSync(viewsPath).toString();

            res.header('content-type', 'text/html');
            res.send(webAppFile);
        });

        fastify.get('/api/providers', async (req, res) => {
            const providers = await DatabaseEngine.All(`SELECT * FROM providers;`);

            res.send(providers);
        });

        fastify.post('/api/providers', async (req, res) => {
            const payload = req.body as any;

            const providerId = await DatabaseEngine.Insert(`INSERT INTO providers (name, stream, epg, connections, last_updated, regex) VALUES (?, ?, ?, ?, ?, ?);`, [
                payload.name,
                payload.stream,
                payload.epg,
                Number(payload.connections),
                0,
                ''
            ]);

            res.send({
                id: providerId,
                name: payload.name,
                stream: payload.stream,
                epg: payload.epg,
                connections: Number(payload.connections),
                last_updated: 0,
                regex: ''
            });
        });

        fastify.get('/api/channels', async (req, res) => {
            const channels = await DatabaseEngine.All(`SELECT * FROM channels;`);

            res.send(channels);
        });

        fastify.post('/api/channel', async (req, res) => {
            const payload = req.body as any;

            const providerId = await DatabaseEngine.Insert(`INSERT INTO channels (name, logo, channel_number) VALUES (?, ?, ?);`, [
                payload.name,
                payload.logo,
                Number(payload.channel_number)
            ]);

            res.send({
                id: providerId,
                name: payload.name,
                stream: payload.logo,
                epg: payload.epg,
                channel_number: Number(payload.connections)
            });
        });

        fastify.get('/channels/:number/video', async (req, res) => {
            const params = req.params as any;

            const channels = await DatabaseEngine.All(`SELECT * FROM channels WHERE channel_number = ${params.number};`) as Channel[];

            if (channels.length === 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const channel = channels[0];

            const channelSources = await DatabaseEngine.All(`SELECT * FROM channel_source WHERE channel_id = ${channel.id};`) as ChannelSource[];

            if (channelSources.length === 0) {
                console.warn(`no sources exist for the channel`)

                res.status(500);

                res.send(500);

                return;
            }

            const channelSource = channelSources[0];

            const sourceStreams = StreamManager.streams.filter(i => i.provider == channelSource.provider_id && i.id === channelSource.provider_channel);

            if (sourceStreams.length === 0) {
                console.warn(`could not fetch source streams`);

                res.status(500);

                res.send(500);

                return;
            }
            
            const sourceStream = sourceStreams[0];

            res.redirect(sourceStream.endpoint, 302);
        });

        fastify.get('/guide.xml', async (req, res) => {
            console.log(`[Piparr] Request to build guide`);

            const channels = await DatabaseEngine.All(`SELECT * FROM channels;`) as Channel[];

            console.log(`[Piparr] Will build guide for ${channels.length} channel(s)`);

            const channelSources = await DatabaseEngine.All(`SELECT * FROM channel_source;`) as ChannelSource[];

            const epgBuilder: EpgBuilder = {
                channels: [],
                programs: []
            }

            for(const channel of channels) {
                const channelSource = channelSources.find(i => i.channel_id === channel.id);

                if (typeof channelSource === 'undefined')
                    continue;

                const epgSource = StreamManager.epg.find(i => i.provider === channelSource.provider_id);

                if (typeof epgSource === 'undefined')
                    continue;

                const epgChannels: XmltvChannel[] = epgSource.epg.channels || [];
                const epgProgramsAll: XmltvProgramme[] = epgSource.epg.programmes || [];

                const epgChannel = epgChannels.find(i => i.id === channelSource.provider_channel);

                if (typeof epgChannel === 'undefined')
                    continue;

                console.log(`[Piparr] channel ${channel.channel_number} (${channel.name}, id=${channelSource.provider_channel}) has xmltv guide entry`)

                const epgPrograms = epgProgramsAll.filter(i => i.channel === channelSource.provider_channel);

                epgBuilder.channels.push(epgChannel);
                epgBuilder.programs = epgBuilder.programs.concat(epgPrograms);
            }

            const epgOut = writeXmltv(epgBuilder);

            res.header('content-type', 'application/xml');

            res.send(epgOut);
        });

        fastify.get('/device.xml', (req, res) => {
            const host = req.protocol + '://' + req.hostname;
            return res
                .type('application/xml')
                .send(Advertise.Instance().getHdhrDeviceXml(host));
        });

        fastify.get('/discover.json', (req, res) => {
            return res.send(
                Advertise.Instance().getHdhrDevice(
                req.protocol + '://' + req.hostname,
                ),
            );
        });

        fastify.get('/lineup_status.json', (req, res) => {
            return res.send({
                ScanInProgress: 0,
                ScanPossible: 1,
                Source: 'Cable',
                SourceList: ['Cable'],
            });
        });

        fastify.get('/lineup.json', async (req, res) => {
            const storedChannels = await DatabaseEngine.All(`SELECT * FROM channels;`) as Channel[];

            const lineup: any[] = [];

            for (const channel of storedChannels) {
                lineup.push({
                    GuideNumber: channel.channel_number.toString(),
                    GuideName: channel.name,
                    URL: `${req.protocol}://${req.hostname}/channels/${channel.channel_number}/video`,
                });
            }

            return res.send(lineup);
        });

        fastify.listen({ host: '0.0.0.0', port: 34400 }, (err, addr) => {
            if (err)
                throw err;

            console.log(`[Piparr] web server is live ${addr}`)
        })
    };
}