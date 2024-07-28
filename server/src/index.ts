import { Advertise } from "./Advertise";
import { DatabaseEngine } from "./DatabaseEngine";
import StreamManager from "./StreamManager";
import WebServer from "./WebServer";

import fs from 'node:fs';
import path from 'node:path';

export default class Piparr {
    public static dataDir: string;

    public static async CreateDirectories() {
        const dataPath = path.resolve('./data');

        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath);
        }

        this.dataDir = dataPath;
    }

    public static async main() : Promise<void> {
        this.CreateDirectories()

        await DatabaseEngine.Init();

        Advertise.Instance();

        StreamManager.MonitorStreams();

        WebServer.Run();
    }
}

Piparr.main().catch(e => {
    console.error(e);

    process.exit(1);
});