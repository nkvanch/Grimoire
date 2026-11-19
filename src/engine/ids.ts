/** A new id for a record this device creates: `prefix_time_random`. Unique enough for local records; not a secret and not ordered. */
export const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
