export declare class Lru<K, V> {
    private readonly capacity;
    private readonly map;
    constructor(capacity: number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    delete(key: K): boolean;
    clear(): void;
    get size(): number;
}
