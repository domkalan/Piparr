import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormDataCommon } from './common/FormDataCommon';
import { Typeahead } from 'react-bootstrap-typeahead';

export const ChannelManager = () => {
    const [channel, setChannel] = React.useState<any>({
        id: null,
        name: '',
        channel_number: null,
        epg: '',
        logo: ''
    });
    const [streams, setStreams] = React.useState<any[]>([]);
    const [selectedStreams, setSelectedStreams] = React.useState<any[]>([]);

    const [streamSources, setStreamSources] = React.useState<any[]>([]);
    const [selectedSources, setSelectedSources] = React.useState<any[]>([]);

    const params = useParams<any>();

    const fetchChannel = async () => {
        const channelReq = await fetch('/api/channels/' + (params as any).channelId);
        const channelRes = await channelReq.json();

        setChannel(channelRes);
    }

    const fetchStreams = async () => {
        const channelReq = await fetch('/api/streams');
        const channelRes = await channelReq.json();

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

    const fetchStreamSources = async () => {
        const sourcesReq = await fetch('/api/channels/' + (params as any).channelId + '/streams');
        const sourcesRes = await sourcesReq.json();

        console.log(sourcesRes)

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

    const fetchStreamSourcesForSelected = async (selected: any[]) => {
        setSelectedStreams(selected);

        console.log(selected)

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

    const deleteChannelSources = async (event: React.FormEvent<Element>) => {
        event.preventDefault();

        const channelReq = await fetch('/api/channels/' + channel.id + '/streams', {
            method: 'DELETE'
        });

        const channelRes : any = await channelReq.json();

        setSelectedSources([]);
        setSelectedStreams([]);
    }

    
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
                            <form onSubmit={(e) => { e.preventDefault(); }}>
                                <div className='form-group'>
                                    <label>Channel Name</label>
                                    <input className="form-control" name="name" type="text" placeholder='ACME 24/7' required defaultValue={channel.name}/>
                                </div>

                                <div className='form-group'>
                                    <label>Guide Logo</label>
                                    <input className="form-control" name="logo" type="text" placeholder='https://www.example.com/acme.png' required defaultValue={channel.logo}/>
                                </div>

                                <button className='btn btn-success'>Update</button>
                            </form>
                        </div>
                        <div className="creation-field">
                            <h5>EPG Binding</h5><hr/>
                            <form onSubmit={(e) => { e.preventDefault(); }}>
                                <div className='form-group'>
                                    <label>EPG Source</label>
                                    <select className="form-select" name="epg" defaultValue='null' disabled>
                                        <option value="null" disabled></option>
                                    </select>
                                </div>

                                <button className='btn btn-success'>Update EPG</button>
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
                        <div className="card">
                            <img src={channel.logo} className="card-img-top" alt={channel.name}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
};