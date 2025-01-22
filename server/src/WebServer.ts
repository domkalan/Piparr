import path from 'node:path';
import fs from 'node:fs';

import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import { writeXmltv, XmltvChannel, XmltvProgramme, Xmltv } from '@iptv/xmltv';

import { Advertise } from "./Advertise";
import StreamManager from "./StreamManager";
import { DatabaseEngine } from './DatabaseEngine';
import { Channel, ChannelSource, EpgBuilder, Stream } from './types';

/**
 * WebServer provides the routes and general setup for Piparr
 */
export default class WebServer {
    /**
     * Start our web server
     */
    public static Run() {
        // Create the fastify web server with logger enabled
        const fastify = Fastify({
            logger: true
        });

        //#region Static Routes
        // Register our static routes
        fastify.register(FastifyStatic, {
            root: path.resolve('./static'),
            prefix: '/static/',
        });

        // Index route redirect for /web/index.html
        fastify.get('/', (req, res) => {
            res.redirect('/web/index.html', 302);
        });

        // Main web app
        fastify.get('/web/index.html', (req, res) => {
            const viewsPath = path.resolve(path.join('./views', 'web.html'));
            const webAppFile = fs.readFileSync(viewsPath).toString();

            res.header('content-type', 'text/html');
            res.send(webAppFile);
        });
        //#endregion

        //#region API Routes
        // API route to return streams
        fastify.get('/api/streams', async (req, res) => {
            const streams = await DatabaseEngine.All(`SELECT * FROM streams;`);

            res.send(streams);
        });

        // API route to create streams
        fastify.post('/api/streams', async (req, res) => {
            const payload = req.body as any;

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

        // API route to delete streams
        fastify.delete('/api/streams/:streamId', async (req, res) => {
            const params = req.params as any;

            const channelsUsing = await DatabaseEngine.AllSafe(`SELECT * FROM channel_source WHERE stream_id = ?;`, [params.streamId]) as ChannelSource[];

            if (channelsUsing.length > 0) {
                res.status(400);

                res.send({ error: 'Can not delete stream, stream has sources used by channels.' })

                return;
            }

            await DatabaseEngine.RunSafe(`DELETE FROM streams WHERE id = ?;`, [params.streamId]);

            res.send(true);
        });

        // API route to reset health on streams
        fastify.post('/api/streams/:streamId/resetHealth', async (req, res) => {
            const params = req.params as any;

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

        // API route to get sources for streams
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

        // API route to get channels created
        fastify.get('/api/channels', async (req, res) => {
            const channels = await DatabaseEngine.All(`SELECT * FROM channels;`);

            res.send(channels);
        });

        // API route to create a new channel
        fastify.post('/api/channels', async (req, res) => {
            const payload = req.body as any;

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

        // API route to get information about a channel
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

        // API route to update stream sources connected to a channel
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

            // fetch all streams
            const streams = await DatabaseEngine.All(`SELECT * FROM streams`) as Stream[];

            // fetch all current sources for this channel
            const sources = await DatabaseEngine.AllSafe(`SELECT * FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];

            // loop through new provided streams
            for(const sourceId of body.sources) {
                const existingSource = sources.find(i => i.stream_channel === sourceId);

                // if channel already exists we skip
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

            // remove invalidated sources, channels that exist in the db and not in the new payload will be removed
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

        // delete all source streams from a channel
        fastify.delete('/api/channels/:channelId', async (req, res) => {
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

            await DatabaseEngine.AllSafe(`DELETE FROM channels WHERE id = ?`, [ channel.id ]) as ChannelSource[];

            await DatabaseEngine.AllSafe(`DELETE FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];
            
            res.send(200)
        });

        // delete all source streams from a channel
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

        // get the source streams for a channel
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

            // fetch all streams
            const streams = await DatabaseEngine.All(`SELECT * FROM streams`) as Stream[];

            // fetch all current sources for this channel
            const sources = await DatabaseEngine.AllSafe(`SELECT * FROM channel_source WHERE channel_id = ?`, [ channel.id ]) as ChannelSource[];

            let selectedStreams : any[] = [];
            let selectedSources: any[] = [];

            // we need to do some pairing up here to display correctly
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
        //#endregion

        //#region HDHomeRun Routes
        // HDHomeRun Route to get raw video source of stream
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

        // Generate the EPG data into an XMLTV output
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

        // Get information about the HDHomeRun device
        fastify.get('/device.xml', (req, res) => {
            const host = req.protocol + '://' + req.hostname;
            return res
                .type('application/xml')
                .send(Advertise.Instance().getHdhrDeviceXml(host));
        });

        // Get information about the HDHomeRun device
        fastify.get('/discover.json', (req, res) => {
            return res.send(
                Advertise.Instance().getHdhrDevice(
                req.protocol + '://' + req.hostname,
                ),
            );
        });

        // Get information about the HDHomeRun device, specifically our capabilities
        fastify.get('/lineup_status.json', (req, res) => {
            return res.send({
                ScanInProgress: 0,
                ScanPossible: 1,
                Source: 'Cable',
                SourceList: ['Cable'],
            });
        });

        // Display the lineup we have enabled to emulate an HDHomeRUn device
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
        //#endregion

        // Make the server listen to accept traffic
        fastify.listen({ host: '0.0.0.0', port: 34400 }, (err, addr) => {
            if (err)
                throw err;

            console.log(`[Piparr] web server is live ${addr}`)
        })
    };
}