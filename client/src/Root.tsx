import * as React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ChannelsLineup } from './Channels';
import { ProviderManager } from './Providers';

// mount app on dom
export const AppRoot = () => {
    return(
        <div>
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <div className="container-fluid">
                    <Link className="navbar-brand" to="/">Piparr</Link>
                    <button className="navbar-toggler" type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#navbarSupportedContent"
                        aria-controls="navbarSupportedContent" aria-expanded="false"
                        aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse"
                        id="navbarSupportedContent">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                            <li className="nav-item">
                                <Link className="nav-link active" aria-current="page" to="/channels">Channels</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/providers">Providers</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link" to="/settings">Settings</Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <Routes>
                <Route path='/channels' element={<ChannelsLineup/>}/>

                <Route path='/providers' element={<ProviderManager/>}/>
            </Routes>
        </div>
    );
}