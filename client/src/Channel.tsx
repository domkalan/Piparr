import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormDataCommon } from './common/FormDataCommon';
import { Typeahead } from 'react-bootstrap-typeahead';

export const ChannelManager = () => {
    const [channel, setChannel] = React.useState<any>({
        id: null,
        name: '',
        channel_number: null,
        epg: ''
    });
    const [streams, setStreams] = React.useState<any[]>([]);
    const [selectedStreams, setSelectedStreams] = React.useState<any[]>([]);

    const [streamSources, setStreamSources] = React.useState<any[]>([]);
    const [selectedSources, setSelectedSources] = React.useState<any[]>([]);

    const params = useParams<any>();

    // fetch channel info
    const fetchChannel = async () => {
        const channelReq = await fetch('/api/channels/' + (params as any).channelId);
        const channelRes = await channelReq.json();

        setChannel(channelRes);
    }

    // fetch stream info for all of streams
    const fetchStreams = async () => {
        const channelReq = await fetch('/api/streams');
        const channelRes = await channelReq.json();

        // we need to do a map to show stream health
        setStreams(channelRes.map((i : any) => { 
            let status = 'Healthy';

            if (i.healthy === 0) {
                status = 'Failed'
            } else if (i.healthy === 2) {
                status = 'Refreshing'
            }

            return { ...i, label: `${i.name} (${status})` }
        }));
    }

    // fetch all sources for streams
    const fetchStreamSources = async () => {
        const sourcesReq = await fetch('/api/channels/' + (params as any).channelId + '/streams');
        const sourcesRes = await sourcesReq.json();

        setStreamSources(sourcesRes.sources);
        setSelectedSources(sourcesRes.sources);
        setSelectedStreams(sourcesRes.streams.map((i : any) => { 
            let status = 'Healthy';

            if (i.healthy === 0) {
                status = 'Failed'
            } else if (i.healthy === 2) {
                status = 'Refreshing'
            }

            return { ...i, label: `${i.name} (${status})` }
        }));
    }

    // get sources for streams that we wish to use for our channel
    const fetchStreamSourcesForSelected = async (selected: any[]) => {
        setSelectedStreams(selected);

        // remove any sources from deselected streams
        const selectedSourcesUpdated = selectedSources.filter(i => selected.filter(ii => ii.id === i.stream).length > 0);

        setSelectedSources(selectedSourcesUpdated);

        // gather info about selected sources
        let sources : any[] = [];

        for(const streamSelected of selected) {
            const channelReq = await fetch('/api/streams/' + streamSelected.id + "/sources");
            const channelRes = await channelReq.json();

            sources = ([] as any[]).concat(sources, channelRes)
        }

        setStreamSources(sources);
    }

    // send a PUT request to update the stream sources for this channel
    const updateChannelSources = async (event: React.FormEvent<Element>) => {
        event.preventDefault();

        const channelReq = await fetch('/api/channels/' + channel.id + '/streams', {
            method: 'PUT',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ sources: selectedSources.map(i => i.id) })
        });

        const channelRes : any = await channelReq.json();
    }

    // Send a put request to update the channel information
    const updateChannelInfo = async (event: React.FormEvent<Element>) => {
         event.preventDefault();
        
        const form = event.target as HTMLFormElement;

        const formData = FormDataCommon.CollectForm(form);

        const channelReq = await fetch('/api/channels/' + channel.id, {
            method: 'PUT',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const channelNew = Object.assign({}, channel)

        channelNew.name = formData.name;
        channelNew.logo = formData.logo;
        channelNew.epg = formData.epg;

        setChannel(channelNew)
    }

    // Delete the channel stream sources, clean wipe
    const deleteChannelSources = async (event: React.FormEvent<Element>) => {
        event.preventDefault();

        const channelReq = await fetch('/api/channels/' + channel.id + '/streams', {
            method: 'DELETE'
        });

        const channelRes : any = await channelReq.json();

        setSelectedSources([]);
        setSelectedStreams([]);
    }

    // Get the basic channel info
    const fetchChannelData = async () => {
        await fetchStreams()

        await fetchChannel();

        await fetchStreamSources();
    }

    React.useEffect(() => {
        fetchChannelData();
    }, []);

    return(
        <div className="content">
            <div className='container'>
                <h3>{channel.name}</h3><br/><p>id: {channel.id}, number: {channel.channel_number}</p><hr/>

                <div className="row">
                    <div className="col-sm-12 col-md-9">
                        <div>
                            <h5>Guide Settings</h5><hr/>
                            <form onSubmit={(e) => { updateChannelInfo(e); }}>
                                <div className='form-group'>
                                    <label>Channel Name</label>
                                    <input className="form-control" name="name" type="text" placeholder='ACME 24/7' required defaultValue={channel.name}/>
                                </div>

                                <div className='form-group'>
                                    <label>Guide Number</label>
                                    <input className="form-control" name="channel_number" type="text" disabled defaultValue={channel.channel_number}/>
                                </div>

                                <div className='form-group'>
                                    <label>Logo</label>
                                    <input className="form-control" name="logo" type="text" placeholder='https://example.com/logo.png' defaultValue={channel.logo}/>
                                </div>

                                <div className='form-group'>
                                    <label>EPG Name</label>
                                    <input className="form-control" name="epg" type="text" placeholder='acme247.us' defaultValue={channel.epg}/>
                                </div>

                                <button className='btn btn-success'>Update</button>
                            </form>
                        </div>
                        <div className="creation-field">
                            <h5>Sources</h5><hr/>
                            {selectedStreams.filter(i => i.healthy !== 1).length > 0 &&
                                <div className="alert alert-warning">You have selected one or more streams that are currently not healthy.</div>
                            }
                            <form onSubmit={(e) => { e.preventDefault(); }}>
                                <div className='form-group'>
                                    <label>Streams</label>
                                    <Typeahead
                                        id='streams'
                                        className='mb-4'
                                        onChange={(selected) => {
                                            fetchStreamSourcesForSelected(selected);
                                        }}
                                        options={streams}
                                        labelKey='label'
                                        multiple
                                        selected={selectedStreams}
                                    />
                                </div>

                                <div className='form-group'>
                                    <label>Stream Sources</label>
                                    <Typeahead
                                        id='stream-sources'
                                        className='mb-4'
                                        onChange={(selected) => {
                                            setSelectedSources(selected)
                                        }}
                                        options={streamSources}
                                        labelKey='name'
                                        multiple
                                        selected={selectedSources}
                                        disabled={streamSources.length === 0}
                                    />
                                </div>

                                <button className='btn btn-success' onClick={(e) => { updateChannelSources(e); }}>Update Sources</button>
                                <button className='btn btn-danger ms-2' onClick={(e) => { deleteChannelSources(e); }}>Delete Sources</button>
                            </form>
                        </div>
                    </div>
                    <div className="col-sm-12 col-md-3">
                        <h5 className="mb-2">Channels Help</h5>
                        <ol className="list-group">
                            <li className="list-group-item">
                                <div className="fw-bold">Logo</div>
                                By default, channel logos are pulled from the EPG provider. If the EPG provider does not provide a logo, or you would like to set a custom logo you may provide one. 
                            </li>
                            <li className="list-group-item">
                                <div className="fw-bold">EPG Name</div>
                                The name of the channel on the EPG provider's XMLTV listing. For example, the channel "ACME 24/7" may have an EPG channel name as "acme247.us". If this value is left blank, the channel name from the stream provider will be used.
                            </li>
                        </ol>
                        <a className="wiki-link independent-link" href="https://github.com/domkalan/Piparr/wiki" target="_blank">Open Piparr wiki</a>
                    </div>
                </div>
            </div>
        </div>
    )
};