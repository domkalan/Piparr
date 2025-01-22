import path from 'node:path';
import fs from 'node:fs';

import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import { writeXmltv, XmltvChannel, XmltvProgramme, Xmltv } from '@iptv/xmltv';

import { Advertise } from "./Advertise";
import StreamManager from "./StreamManager";
import { DatabaseEngine } from './DatabaseEngine';
import { Channel, ChannelSource, EpgBuilder, Stream } from './types';

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

        fastify.get('/api/streams', async (req, res) => {
            const streams = await DatabaseEngine.All(`SELECT * FROM streams;`);

            res.send(streams);
        });

        fastify.post('/api/streams', async (req, res) => {
            const payload = req.body as any;

            console.log(payload)

            const streamId = await DatabaseEngine.Insert('INSERT INTO streams (name, stream, connections, last_updated, type, regex) VALUES (?, ?, ?, ?, ?, ?);', [
                payload.name,
                payload.stream,
                Number(payload.connections),
                0,
                payload.type,
                ''
            ]);

            res.send({
                id: streamId,
                name: payload.name,
                stream: payload.stream,
                connections: Number(payload.connections),
                last_updated: 0,
                type: payload.type,
                regex: ''
            });
        });

        fastify.delete('/api/streams/:streamId', async (req, res) => {
            const params = req.params as any;

            console.log(params)

            await DatabaseEngine.RunSafe(`DELETE FROM streams WHERE id = ?;`, [params.streamId]);

            res.send(true);
        });

        fastify.post('/api/streams/:streamId/resetHealth', async (req, res) => {
            const params = req.params as any;

            console.log(params)

            const streams = await DatabaseEngine.AllSafe(`SELECT * FROM streams WHERE id = ?;`, [params.streamId]) as Stream[];

            if (streams.length === 0) {
                console.warn(`the requested stream was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            await DatabaseEngine.RunSafe(`UPDATE streams SET healthy = -1 WHERE id = ?`, [ params.streamId ]);

            res.send(true);
        });

        fastify.get('/api/streams/:streamId/sources', async (req, res) => {
            const params = req.params as any;

            const streams = await DatabaseEngine.AllSafe(`SELECT * FROM streams WHERE id = ?;`, [Number.parseInt(params.streamId)]) as Stream[];

            if (streams.length == 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const streamSources = StreamManager.streams.filter(i => i.stream === streams[0].id);

            res.send(streamSources.map((i => {
                return {
                    id: i.id,
                    name: i.name,
                    stream: streams[0].id
                }
            })));
        });

        fastify.get('/api/channels', async (req, res) => {
            const channels = await DatabaseEngine.All(`SELECT * FROM channels;`);

            res.send(channels);
        });

        fastify.post('/api/channels', async (req, res) => {
            const payload = req.body as any;

            console.log(payload)

            const streamId = await DatabaseEngine.Insert(`INSERT INTO channels (name, logo, epg, channel_number) VALUES (?, ?, ?, ?);`, [
                payload.name,
                payload.logo,
                'null',
                Number(payload.channel_number)
            ]);

            res.send({
                id: streamId,
                name: payload.name,
                stream: payload.logo,
                epg: '',
                channel_number: Number(payload.channel_number)
            });
        });

        fastify.get('/api/channels/:channelId', async (req, res) => {
            const params = req.params as any;

            const channels = await DatabaseEngine.All(`SELECT * FROM channels WHERE id = ${params.channelId};`) as Channel[];

            if (channels.length === 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const channel = channels[0];

            const sources = await DatabaseEngine.All(`SELECT * FROM channel_source WHERE channel_id = ${channel.id};`) as ChannelSource[];

            res.send({
                ...channel,
                sources: sources
            })
        });

        fastify.put('/api/channels/:channelId/streams', async (req, res) => {
            const params = req.params as any;
            const body = req.body as any;

            const channels = await DatabaseEngine.AllSafe('SELECT * FROM channels WHERE id = ?;', [params.channelId]) as Channel[];

            if (channels.length === 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const channel = channels[0];

            const streams = await DatabaseEngine.All(`SELECT * FROM streams`) as Stream[];
            const sources = await DatabaseEngine.AllSafe(`SELECT * FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];

            // loop through new provided streams
            for(const sourceId of body.sources) {
                const existingSource = sources.find(i => i.stream_channel === sourceId);

                if (typeof existingSource !== 'undefined') {
                    console.log(`[Piparr] Skipping add of source ${sourceId}`);

                    continue;
                }

                const sourceStream = StreamManager.streams.find(i => i.id === sourceId);

                if (typeof sourceStream === 'undefined') {
                    res.status(400);

                    res.send(`400, Stream ${sourceId} could not be validated`);
                    
                    return;
                }

                const parentStream = streams.find(i => i.id === sourceStream.stream);
                
                if (typeof parentStream === 'undefined') {
                    res.status(400);

                    res.send(`400, Stream ${sourceStream.stream} could not be validated`);

                    return;
                }

                console.log(`[Piparr] Adding source ${sourceId} from ${sourceStream.name} into channel ${channel.name}`);

                await DatabaseEngine.Insert(`INSERT INTO channel_source (stream_id, channel_id, stream_channel) VALUES (?, ?, ?);`, [
                    sourceStream.stream,
                    channel.id,
                    sourceStream.id
                ]);
            }

            // remove invalidated sources
            for(const existingSource of sources) {
                if (body.sources.includes(existingSource)) {
                    console.log(`[Piparr] source ${existingSource.stream_id} from stream ${existingSource.stream_channel} validated`);

                    continue;
                }

                await DatabaseEngine.RunSafe(`DELETE FROM channel_source WHERE id = ?;`, [ existingSource.id ]);

                console.log(`[Piparr] source (id:${existingSource.id}) ${existingSource.stream_id} from stream ${existingSource.stream_channel} deleted`);
            }

            res.send(200)
        });

        fastify.delete('/api/channels/:channelId/streams', async (req, res) => {
            const params = req.params as any;
            const body = req.body as any;

            const channels = await DatabaseEngine.AllSafe('SELECT * FROM channels WHERE id = ?;', [params.channelId]) as Channel[];

            if (channels.length === 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const channel = channels[0];

            await DatabaseEngine.AllSafe(`DELETE FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];
            
            res.send(200)
        });

        fastify.get('/api/channels/:channelId/streams', async (req, res) => {
            const params = req.params as any;

            const channels = await DatabaseEngine.AllSafe('SELECT * FROM channels WHERE id = ?;', [params.channelId]) as Channel[];

            if (channels.length === 0) {
                console.warn(`the requested channel was not found`)

                res.status(404);

                res.send(404);

                return;
            }

            const channel = channels[0];

            const sources = await DatabaseEngine.AllSafe(`SELECT * FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];
            const streams = await DatabaseEngine.All(`SELECT * FROM streams;`) as Stream[];

            let selectedStreams : any[] = [];
            let selectedSources: any[] = [];

            for(const source of sources) {
                const sourceStream = StreamManager.streams.find(i => i.id === source.stream_channel);

                if (typeof sourceStream === 'undefined')
                    continue;

                const existingStream = selectedStreams.find(i => i.id !== sourceStream.id);

                if (typeof existingStream === 'undefined') {
                    const streamInfo = streams.find(i => i.id === source.stream_id);

                    selectedStreams.push(streamInfo);
                }
    
                selectedSources.push({
                    id: source.stream_channel,
                    name: sourceStream?.name || 'Unknown Stream Source',
                    stream: source.stream_id
                })
            }
            
            res.send({
                streams: selectedStreams,
                sources: selectedSources
            })
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

            const sourceStreams = StreamManager.streams.filter(i => i.stream == channelSource.stream_id && i.id === channelSource.stream_channel);

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
                programs: [],
                xmltv: null
            }

            for(const channel of channels) {
                const channelSource = channelSources.find(i => i.channel_id === channel.id);

                if (typeof channelSource === 'undefined')
                    continue;

                const epgSource = StreamManager.epg.find(i => i.stream === channelSource.stream_id);

                if (typeof epgSource === 'undefined')
                    continue;

                const epgChannels: XmltvChannel[] = epgSource.epg.channels || [];
                const epgProgramsAll: XmltvProgramme[] = epgSource.epg.programmes || [];

                const epgChannel = epgChannels.find(i => i.id === channelSource.stream_channel);

                if (typeof epgChannel === 'undefined')
                    continue;

                console.log(`[Piparr] channel ${channel.channel_number} (${channel.name}, id=${channelSource.stream_channel}) has xmltv guide entry`)

                const epgPrograms = epgProgramsAll.filter(i => i.channel === channelSource.stream_channel);

                epgBuilder.xmltv = epgSource.epg;
                epgBuilder.channels.push(epgChannel);
                epgBuilder.programs = epgBuilder.programs.concat(epgPrograms);
            }

            // recreate epg
            const newEpg: Xmltv = { ... epgBuilder.xmltv };
            newEpg.channels = epgBuilder.channels;
            newEpg.programmes = epgBuilder.programs;

            const epgOut = writeXmltv(newEpg);

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