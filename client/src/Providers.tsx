import * as React from 'react';
import { Route, Routes } from 'react-router-dom';

let formData = {
    name: '',
    stream: '',
    epg: '',
    limit: 1
};

export const ProviderManager = () => {
    return(
        <div>
            <div className='container'>
                <h3>Providers</h3><hr/>

                <table className="table">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">First</th>
                            <th scope="col">Last</th>
                            <th scope="col">Handle</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th scope="row">1</th>
                            <td>Mark</td>
                            <td>Otto</td>
                            <td>@mdo</td>
                        </tr>
                    </tbody>
                </table>

                <div>
                    <h5>Add Provider</h5>
                    <form>
                        <div className='form-group'>
                            <label>Provider Name</label>
                            <input className="form-control" type="text" placeholder='Example Provider' onInput={(e) => { formData.name = e.currentTarget.value }}/>
                        </div>
                        <div className='form-group'>
                            <label>M3U URL</label>
                            <input className="form-control" type="text" placeholder='http://example.com/streams.m3u8?key=xxx' onInput={(e) => { formData.name = e.currentTarget.value }}/>
                        </div>
                        <div className='form-group'>
                            <label>EPG URL</label>
                            <input className="form-control" type="text" placeholder='http://example.com/epg.xml?key=xxx' onInput={(e) => { formData.name = e.currentTarget.value }}/>
                        </div>
                        <div className='form-group'>
                            <label>Stream Limit</label>
                            <input className="form-control" type="number" placeholder='0' defaultValue={1} onInput={(e) => { formData.name = e.currentTarget.value }}/>
                        </div>

                        <button className='btn btn-primary'>Create</button>
                    </form>
                </div>
            </div>
        </div>
    )
};