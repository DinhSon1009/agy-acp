// Minimal LRU map. Backed by a Map, whose insertion order we exploit: on access
// we re-insert the key to mark it most-recently-used, and evict from the front.
export class Lru {
    capacity;
    map = new Map();
    constructor(capacity) {
        this.capacity = capacity;
    }
    get(key) {
        const value = this.map.get(key);
        if (value === undefined)
            return undefined;
        // Re-insert to move to the most-recently-used end.
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }
    set(key, value) {
        if (this.map.has(key))
            this.map.delete(key);
        this.map.set(key, value);
        while (this.map.size > this.capacity) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined)
                break;
            this.map.delete(oldest);
        }
    }
    delete(key) {
        return this.map.delete(key);
    }
    clear() {
        this.map.clear();
    }
    get size() {
        return this.map.size;
    }
}
//# sourceMappingURL=lru.js.map