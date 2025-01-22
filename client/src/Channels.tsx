import * as React from 'react';
import { Link } from 'react-router-dom';
import { FormDataCommon } from './common/FormDataCommon';

export const ChannelsLineup = () => {
    const [channels, setChannels] = React.useState<any[]>([]);

    // Get all channels
    const fetchChannels = async () => {
        const channelReq = await fetch('/api/channels');
        const channelRes = await channelReq.json();

        setChannels(channelRes);
    }

    // Create a channel
    const addChannel = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const form = event.target as HTMLFormElement;

        const formData = FormDataCommon.CollectForm(form);

        const channelReq = await fetch('/api/channels', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const channelRes : any = await channelReq.json();

        FormDataCommon.ResetForm(form);

        setChannels(([] as any).concat(channels, [ channelRes ]))
    }

    // Request a channel be deleted
    const deleteChannel = async(event : React.MouseEvent<Element>, id : string) => {
        event.preventDefault();

        const channelReq = await fetch('/api/channels/' + id, {
            method: 'DELETE'
        });

        const channelRes : any = await channelReq.json();

        setChannels(channels.filter(i => i.id !== id))
    }

    // Confirm we want to delete the channel
    const confirmDeleteChannel = async (event : React.MouseEvent<Element>, id : string) => {
        if (confirm(`Are you sure you want to delete channel id ${id}?`)) {
            await deleteChannel(event, id);

            return;
        }

        event.preventDefault();
    }

    React.useEffect(() => {
            fetchChannels();
    }, []);

    return(
        <div className="content">
            <div className='container'>
                <h3>Channels</h3><hr/>

                <div className="row">
                    <div className="col-sm-12 col-md-9">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">ID</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Guide Number</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {channels.sort((a, b) => ( a.channel_number - b.channel_number )).map((channel : any, i : number) => {
                                    return (
                                        <tr>
                                            <th scope="row">{channel.id}</th>
                                            <td>{channel.name}</td>
                                            <td>{channel.channel_number}</td>
                                            <td><Link to={'/channels/' + channel.id}>Manage</Link> <a href="#" onClick={e => confirmDeleteChannel(e, channel.id)}>Delete</a></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div className="creation-field">
                            <h5>Add Channel</h5>
                            <form onSubmit={(e) => { addChannel(e); }}>
                                <div className='form-group'>
                                    <label>Name</label>
                                    <input className="form-control" name="name" type="text" placeholder='ACME 24/7' required/>
                                </div>

                                <div className='form-group'>
                                    <label>Guide Number</label>
                                    <input className="form-control" name="channel_number" type="number" placeholder='605' required/>
                                </div>

                                <div className='form-group'>
                                    <label>Guide Logo</label>
                                    <input className="form-control" name="logo" type="text" placeholder='https://www.example.com/acme.png' required/>
                                </div>

                                <button className='btn btn-primary'>Create</button>
                            </form>
                        </div>
                    </div>

                    <div className="col-sm-12 col-md-3">
                        <h5 className="mb-2">Channels Help</h5>
                        <ol className="list-group">
                            
                        </ol>
                        <a className="wiki-link independent-link" href="https://github.com/domkalan/Piparr/wiki" target="_blank">Open Piparr wiki</a>
                    </div>
                </div>
            </div>
        </div>
    )
};