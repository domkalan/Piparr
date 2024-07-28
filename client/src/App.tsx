import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoot } from './Root';


// entrypoint for app
export const ClientApp = () => {
    return (
        <HashRouter>
            <AppRoot></AppRoot>
        </HashRouter>
    );
}

// mount app on dom
const mountApp = () => {
    // Mount component 
    const mount = document.getElementById('app') as Element;

    ReactDOM.createRoot(mount).render(<ClientApp/>);
}

// wait for page to be ready
const waitForReady = (callback : () => void) => {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        // call on next available tick
        setTimeout(callback, 10);
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }
}

waitForReady(mountApp);