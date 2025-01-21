import { argv } from "node:process";
import { Worker } from "node:worker_threads";

export abstract class BackgroundThreading {
    public static Run(workerFile: string, payload : any, callback : (err : Error | null, data: any) => void, timeout : number = 0) {
        let callbackCalled = false;

        const worker = new Worker(workerFile, { workerData: payload });
        
        worker.on('message', (data) => {
            if (!callbackCalled) {
                callbackCalled = true;

                callback(null, data);
            }
        });
                        
        worker.on('error', (error) => {
            console.log(`[Piparr][BackgroundThreading] background task has encountered an error`, error);

            worker.terminate();

            if (!callbackCalled) {
                callbackCalled = true;

                callback(new Error(`Background task failed, thread encountered an error ${error}`), null);
            }
        });

        worker.on('exit', () => {
            console.log(`[Piparr][BackgroundThreading] background task has stopped`);
        })

        if (timeout > 0) {
            setTimeout(() => {
                if (!callbackCalled) {
                    callbackCalled = true;

                    worker.terminate();

                    callback(new Error(`Background task failed, thread surpassed timeout of ${timeout}ms`), null);
                }
            }, timeout);
        }
    }
}