import { Advertise } from "./Advertise";
import { DatabaseEngine } from "./DatabaseEngine";
import StreamManager from "./StreamManager";
import WebServer from "./WebServer";

import fs from 'node:fs';
import path from 'node:path';

/**
 * Main application for Piparr
 */
export default class Piparr {
    public static dataDir: string;

    // make sure data directory exists
    public static async CreateDirectories() {
        const dataPath = path.resolve('./data');

        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath);
        }

        this.dataDir = dataPath;
    }

    // main init function
    public static async main() : Promise<void> {
        // create directories
        this.CreateDirectories()

        // create database library
        await DatabaseEngine.Init();

        // advertise our HDHomeRun Device
        Advertise.Instance();

        // begin monitoring streams
        StreamManager.MonitorStreams();

        // run the web server
        WebServer.Run();
    }
}

// start our application
Piparr.main().catch(e => {
    console.error(e);

    process.exit(1);
});