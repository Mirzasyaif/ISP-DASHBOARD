export const store = {
    _cache: {},
    ttl: 30000, // 30 seconds
    get(key) {
        const entry = this._cache[key];
        if (!entry) return null;
        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            delete this._cache[key];
            return null;
        }
        return entry.data;
    },
    set(key, data) {
        this._cache[key] = { data, timestamp: Date.now() };
    }
};