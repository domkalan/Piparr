import * as React from 'react';
import { FormDataCommon } from './common/FormDataCommon';

export const StreamManager = () => {
    const [streams, setStreams] = React.useState<any[]>([]);

    // fetch all streams, add health to display on label
    const fetchStreams = async () => {
        const providerReq = await fetch('/api/streams');
        const providerRes = await providerReq.json();

        setStreams(providerRes.map((i : any) => {
            let providerState = 'Unknown State'

            if (i.healthy === 0) {
                providerState = 'Failed'
            } else if (i.healthy === 1) {
                providerState = 'Healthy'
            } else if (i.healthy === 2) {
                providerState = 'Refreshing'
            } else if (i.healthy === -1) {
                providerState = 'Retrying'
            }

            return {
                ...i,
                healthState: providerState
            }
        }));
    }

    // TODO: rename provider to streams
    // add a new provider (stream)
    const addProvider = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const formData = FormDataCommon.CollectForm(form);

        const providerReq = await fetch('/api/streams', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const providerRes : any = await providerReq.json();

        FormDataCommon.ResetForm(form);

        setStreams(([] as any).concat(streams, [ providerRes ]))
    }

    // delete a provider (stream)
    const deleteProvider = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const providerReq = await fetch('/api/streams/' + id, {
            method: 'DELETE'
        });

        const providerRes : any = await providerReq.json();

        if (typeof providerRes.error !== 'undefined') {
            alert(providerRes.error)

            return;
        }

        setStreams(streams.filter(i => i.id !== id))
    }

    // reset health on a provider
    const resetProvider = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const providerReq = await fetch('/api/streams/' + id + '/resetHealth', {
            method: 'POST'
        });

        const providerRes = await providerReq.json();

        setTimeout(() => {
            fetchStreams();
        }, 500);
    }

    // Confirm that you want to delete a stream
    const confirmDeleteProvider = async (event : React.MouseEvent<Element>, id : string) => {
        if (confirm(`Are you sure you want to delete provider ${id}?`)) {
            await deleteProvider(event, id);

            return;
        }

        event.preventDefault();
    }

    // Confirm that you want to delete a stream
    const setRegexForProvider = async (event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        let currentRegex = '';
        
        const streamObject = streams.find(i => i.id === id);

        if (typeof streamObject !== 'undefined') {
            currentRegex = streamObject.regex;
        }

        const regexFilter = prompt('Enter regex filter:', currentRegex) || currentRegex;

        if (currentRegex === regexFilter)
            return;

        const providerReq = await fetch('/api/streams/' + id + '/regex', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({ regex: regexFilter })
        });

        const providerRes = await providerReq.json();

        setTimeout(() => {
            fetchStreams();
        }, 500);
    }

    React.useEffect(() => {
        fetchStreams();
    }, [])

    return(
        <div className="content">
            <div className='container'>
                <h3>Streams</h3><hr/>

                <div className="row">
                    <div className="col-sm-12 col-md-9">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Regex</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {streams.map((provider : any, i : number) => {
                                    return (
                                        <tr>
                                            <th scope="row">{provider.id}</th>
                                            <td>{provider.name}</td>
                                            <td>{provider.healthState}</td>
                                            <td><code className='code-block'>{provider.regex}</code></td>
                                            <td><a href="#" onClick={e => resetProvider(e, provider.id)}>Rescan</a> <a href="#" onClick={e => setRegexForProvider(e, provider.id)}>Set Regex</a> <a href="#" onClick={e => confirmDeleteProvider(e, provider.id)}>Delete</a></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="creation-field">
                            <h5>Add Provider</h5>
                            <form onSubmit={(e) => { addProvider(e) }}>
                                <div className='form-group'>
                                    <label>Name</label>
                                    <input className="form-control" name="name" type="text" placeholder='Example Stream' required/>
                                </div>

                                <div className='form-group'>
                                    <label>URL</label>
                                    <input className="form-control" name="stream" type="text" placeholder='http://example.com/streams.m3u8?key=xxx' required/>
                                </div>

                                <div className='form-group'>
                                    <label>Type</label>
                                    <select className="form-select" name="type" defaultValue='null' required>
                                        <option value="null" disabled></option>
                                        <option value="playlist">Playlist</option>
                                        <option value="direct">Direct</option>
                                    </select>
                                    <small>
                                        Use <code>Playlist</code> if the stream endpoint contains a playlist of other streams.<br/>
                                        Use <code>Direct</code> if the source is a direct video stream.<br/>
                                    </small>
                                </div>

                                <div className='form-group'>
                                    <label>Connection Limit</label>
                                    <input className="form-control" name="connections" type="number" placeholder='0' defaultValue={1} required/>
                                    <small>Enter <code>0</code> if this stream does not have a connection limit.</small>
                                </div>

                                <button className='btn btn-primary'>Create</button>
                            </form>
                        </div>
                    </div>

                    <div className="col-sm-12 col-md-3">
                        <h5 className="mb-2">Streams Help</h5>
                        <ol className="list-group">
                            <li className="list-group-item">
                                <div className="fw-bold">What is a stream?</div>
                                Streams are the building block for Piparr to access media and create channels. A stream exists independent from a channel as channels can source their content from multiple streams in the event a stream reaches its connection limit.
                            </li>
                            <li className="list-group-item">
                                <div className="fw-bold">Playlist vs Direct?</div>
                                A playlist stream is a collection of streams often offered through IPTV service streams. A direct stream is a single source stream that usually only broadcasts one channel. Direct streams are most commonly used for local TV stations.
                            </li>
                        </ol>
                        <a className="wiki-link independent-link" href="https://github.com/domkalan/Piparr/wiki" target="_blank">Open Piparr wiki</a>
                    </div>
                </div>
            </div>
        </div>
    )
};