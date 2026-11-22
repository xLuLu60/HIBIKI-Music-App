const copy = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export class SearchCache {
  constructor({ ttl = 5 * 60_000, maxEntries = 80 } = {}) {
    this.ttl = ttl; this.maxEntries = maxEntries; this.entries = new Map();
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expires <= Date.now()) { this.entries.delete(key); return null; }
    this.entries.delete(key); this.entries.set(key, entry);
    return copy(entry.value);
  }
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value: copy(value), expires: Date.now() + this.ttl });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
  }
  clear() { this.entries.clear(); }
}
