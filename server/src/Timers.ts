export abstract class Timers {
    public static WaitFor(time: number) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(true);
            }, time)
        });
    }
}