import { argv } from "node:process";
import { Worker } from "node:worker_threads";

/**
 * BackgroundThreading
 * 
 * Allows large blocking tasks to be ran on the background using Workers.
 * 
 */
export abstract class BackgroundThreading {
    /**
     * Run a defined worker file in the background.
     * @param workerFile The path for the file to run.
     * @param payload The payload to pass into the worker.
     * @param callback The callback to be run once the worker emits a message.
     * @param timeout Should the worker be terminated after a time, useful for things that might hang.
     */
    public static Run(workerFile: string, payload : any, callback : (err : Error | null, data: any) => void, timeout : number = 0) {
        // track if we fired the callback
        let callbackCalled = false;

        // create the worker
        const worker = new Worker(workerFile, { workerData: payload });
        
        // listen for worker message
        worker.on('message', (data) => {
            if (!callbackCalled) {
                callbackCalled = true;

                callback(null, data);
            }
        });
                
        // if worker errors out, terminate it pass error to callback
        worker.on('error', (error) => {
            console.log(`[Piparr][BackgroundThreading] background task has encountered an error`, error);

            worker.terminate();

            if (!callbackCalled) {
                callbackCalled = true;

                callback(new Error(`Background task failed, thread encountered an error ${error}`), null);
            }
        });

        // debug for when worker exits
        worker.on('exit', () => {
            console.log(`[Piparr][BackgroundThreading] background task has stopped`);
        })

        // timeout only if timeout var is provided
        if (timeout > 0) {
            setTimeout(() => {
                if (!callbackCalled) {
                    callbackCalled = true;

                    // terminate worker if timeout reached
                    worker.terminate();

                    callback(new Error(`Background task failed, thread surpassed timeout of ${timeout}ms`), null);
                }
            }, timeout);
        }
    }
}