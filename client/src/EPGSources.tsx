import * as React from 'react';
import { FormDataCommon } from './common/FormDataCommon';

export const EPGManager = () => {
    const [epgSources, setEpgSources] = React.useState<any[]>([]);
    const [epgRemaps, setEpgRemaps] = React.useState<any[]>([]);

    // fetch all streams, add health to display on label
    const fetchEpgSources = async () => {
        const providerReq = await fetch('/api/epgsources');
        const providerRes = await providerReq.json();

        setEpgSources(providerRes.map((i : any) => {
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

    // add a new source
    const addEpgSource = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const formData = FormDataCommon.CollectForm(form);

        const providerReq = await fetch('/api/epgsources', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const providerRes : any = await providerReq.json();

        FormDataCommon.ResetForm(form);

        setEpgSources(([] as any).concat(epgSources, [ providerRes ]))
    }

    // delete a source
    const deleteEpgSource = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const providerReq = await fetch('/api/epgsources/' + id, {
            method: 'DELETE'
        });

        const providerRes : any = await providerReq.json();

        if (typeof providerRes.error !== 'undefined') {
            alert(providerRes.error)

            return;
        }

        setEpgSources(epgSources.filter(i => i.id !== id))
    }

    // reset health on a provider
    const resetEpgSource = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const providerReq = await fetch('/api/epgsources/' + id + '/resetHealth', {
            method: 'POST'
        });

        const providerRes = await providerReq.json();

        setTimeout(() => {
            fetchEpgSources();
        }, 500)
    }

    // Confirm that you want to delete a stream
    const confirmDeleteEpgSource = async (event : React.MouseEvent<Element>, id : string) => {
        if (confirm(`Are you sure you want to delete provider ${id}?`)) {
            await deleteEpgSource(event, id);

            return;
        }

        event.preventDefault();
    }

    // fetch the list of epg remaps
    const fetchEpgRemaps = async () => {
        const providerReq = await fetch('/api/epgremaps');
        const providerRes = await providerReq.json();

        setEpgRemaps(providerRes);
    }

    const addEpgRemap = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const formData = FormDataCommon.CollectForm(form);

        const providerReq = await fetch('/api/epgremaps', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const providerRes : any = await providerReq.json();

        FormDataCommon.ResetForm(form);

        setEpgRemaps(([] as any).concat(epgRemaps, [ providerRes ]))
    }

    const deleteEpgRemap = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const providerReq = await fetch('/api/epgremaps/' + id, {
            method: 'DELETE'
        });

        const providerRes : any = await providerReq.json();

        if (typeof providerRes.error !== 'undefined') {
            alert(providerRes.error)

            return;
        }

        setEpgRemaps(epgSources.filter(i => i.id !== id))
    }

    const confirmDeleteEpgRemap = async (event : React.MouseEvent<Element>, id : string) => {
        if (confirm(`Are you sure you want to delete provider ${id}?`)) {
            await deleteEpgRemap(event, id);

            return;
        }

        event.preventDefault();
    }

    React.useEffect(() => {
        fetchEpgSources();

        fetchEpgRemaps();
    }, [])

    return(
        <div className="content">
            <div className='container'>
                <h3>EPG Sources</h3><hr/>

                <div className="row">
                    <div className="col-sm-12 col-md-9">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {epgSources.map((provider : any, i : number) => {
                                    return (
                                        <tr>
                                            <th scope="row">{provider.id}</th>
                                            <td>{provider.name}</td>
                                            <td>{provider.healthState}</td>
                                            <td><a href="#" onClick={e => resetEpgSource(e, provider.id)}>Rescan</a> <a href="#" onClick={e => confirmDeleteEpgSource(e, provider.id)}>Delete</a></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="creation-field">
                            <h5>Add EPG Source</h5>
                            <form onSubmit={(e) => { addEpgSource(e) }}>
                                <div className='form-group'>
                                    <label>Name</label>
                                    <input className="form-control" name="name" type="text" placeholder='Example EPG Provider' required/>
                                </div>

                                <div className='form-group'>
                                    <label>Display Name Language Filter</label>
                                    <input className="form-control" name="langRegex" type="text" placeholder='en'/>
                                </div>

                                <div className='form-group'>
                                    <label>Channel Name Filter</label>
                                    <input className="form-control" name="nameRegex" type="text" placeholder='ACME247'/>
                                </div>

                                <div className='form-group'>
                                    <label>ID Filter</label>
                                    <input className="form-control" name="idRegex" type="text" placeholder='.us'/>
                                </div>

                                <div className='form-group'>
                                    <label>URL</label>
                                    <input className="form-control" name="epg" type="text" placeholder='http://example.com/epg.xml?key=xxx' required/>
                                </div>

                                <button className='btn btn-primary'>Create</button>
                            </form>
                        </div>

                        <div style={{ marginTop: 40 }}></div>

                        <h3>EPG Remaps</h3><hr/>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {epgRemaps.map((provider : any, i : number) => {
                                    return (
                                        <tr>
                                            <th scope="row">{provider.id}</th>
                                            <td>{provider.original}</td>
                                            <td>{provider.new}</td>
                                            <td><a href="#" onClick={e => confirmDeleteEpgRemap(e, provider.id)}>Delete</a></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="creation-field">
                            <h5>Add EPG Remap</h5>
                            <form onSubmit={(e) => { addEpgRemap(e) }}>
                                <div className='form-group'>
                                    <label>Original</label>
                                    <input className="form-control" name="original" type="text" placeholder='NewsChannelEast.us' required/>
                                </div>

                                <div className='form-group'>
                                    <label>New</label>
                                    <input className="form-control" name="new" type="text" placeholder='NewsChannel.us' required/>
                                </div>

                                <button className='btn btn-primary'>Create</button>
                            </form>
                        </div>
                    </div>

                    <div className="col-sm-12 col-md-3">
                        <h5 className="mb-2">EPG Help</h5>
                        <ol className="list-group">
                            <li className="list-group-item">
                                <div className="fw-bold">What is EPG?</div>
                                EPG stands for Electronic Program Guide. It is a digital guide that provides information about current and upcoming television programs, including their schedules, descriptions, and other metadata. EPGs are commonly used in digital television systems, streaming platforms, and set-top boxes to help users navigate and select content to watch.
                            </li>
                            <li className="list-group-item">
                                <div className="fw-bold">How does EPG filtering work?</div>
                                EPG Filtering will check a channel's <code>display-name</code> <code><b>lang=</b></code> value for a match using regex. If a match is found, it will be included in the new XML file. If a match is not found, the channel and its associated programming will be discarded.
                            </li>
                            <li className="list-group-item">
                                <div className="fw-bold">What is an EPG remap?</div>
                                EPG remap allows for on the fly renaming of channels. Sometimes an EPG provider may have the channel under a different name than the source provider may have it listed as.
                            </li>
                            <li className="list-group-item">
                                <div className="fw-bold">Raw EPG URLs:</div>
                                Some programs may need the raw EPG URL.
                                <ul>
                                    {epgSources.map((provider : any, i : number) => {
                                        return (
                                            <li><b>{provider.id}:</b> <code>{`${window.location.origin}/static/epg-${provider.id}.xml`}</code></li>
                                        );
                                    })}
                                </ul>
                            </li>
                        </ol>
                        <a className="wiki-link independent-link" href="https://github.com/domkalan/Piparr/wiki" target="_blank">Open Piparr wiki</a>
                    </div>
                </div>
            </div>
        </div>
    )
};