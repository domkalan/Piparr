import * as React from 'react';
import { Link } from 'react-router-dom';

export const Index = () => {
    React.useEffect(() => {
        window.location.hash = '/streams';
    }, []);

    return(
        <div>
            <p>This page has moved <Link to={'/streams'}>/channels</Link></p>
        </div>
    )
};