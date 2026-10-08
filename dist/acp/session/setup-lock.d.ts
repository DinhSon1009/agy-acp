export declare class KeyedAsyncLock {
    #private;
    run<T>(key: string, fn: () => Promise<T>): Promise<T>;
}
