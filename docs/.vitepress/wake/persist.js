// IndexedDB autosave — persists the raw grid + active scenario so a
// reload resumes the cultivated simulation instead of resetting it.
// Best-effort: IDB may be unavailable (private mode); all failures are silent.

import { GRID_BYTE_SIZE, NODE_SIZE_BYTES } from './constants.js';

const DB_NAME = 'planck-wake';
const STORE = 'state';
const KEY = 'autosave';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveSimState(bridge, scenario, topology = 'square') {
    try {
        const ptr = bridge.getGridPointer();
        const grid = new Uint8Array(bridge.wasm.HEAPU8.buffer, ptr, GRID_BYTE_SIZE).slice();
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            // The grid bytes are only meaningful under their own substrate —
            // a field painted on oct8 carries spins the hex engine can't run.
            tx.objectStore(STORE).put({ grid: grid.buffer, scenario, topology, savedAt: Date.now() }, KEY);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        // Autosave must never break the simulation.
    }
}

export async function loadSimState() {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export function restoreSimState(bridge, record) {
    if (!record?.grid || !bridge.wasm.HEAPU8) return;
    const bytes = new Uint8Array(record.grid);
    if (bytes.length !== GRID_BYTE_SIZE) return;
    // A dead autosave would permanently brick the boot — the empty field
    // just re-saves itself on every interval. Quanta sits at byte offset 0
    // of each PlanckNode; if the snapshot carries no mass at all, keep the
    // freshly painted scenario instead.
    let mass = 0;
    for (let i = 0; i < bytes.length; i += NODE_SIZE_BYTES) mass += bytes[i];
    if (mass === 0) return;
    bridge.wasm.HEAPU8.set(bytes, bridge.getGridPointer());
}
