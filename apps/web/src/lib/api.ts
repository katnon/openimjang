const BASE = '/api';

export async function apiGet<T = unknown>(path: string): Promise<T> {
    const r = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json() as Promise<T>
}
