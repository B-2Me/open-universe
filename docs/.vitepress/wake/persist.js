// IndexedDB persistence — the 'state' store autosaves the raw grid +
// active scenario; the 'scenarios' store holds user-authored scenario
// specs from the Composer. Best-effort: IDB may be unavailable (private
// mode); all failures are silent.

import { GRID_BYTE_SIZE, NODE_SIZE_BYTES } from './constants.js';
import { exportSpec, importSpec } from './painter.js';

const DB_NAME = 'planck-wake';
const DB_VERSION = 2;
const STORE = 'state';
const SCENARIOS_STORE = 'scenarios';
const KEY = 'autosave';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            if (!db.objectStoreNames.contains(SCENARIOS_STORE)) db.createObjectStore(SCENARIOS_STORE);
        };
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

// --- Custom scenario specs (Composer library) ---
// Keyed by spec.id; a custom's dropdown value is `custom:<id>`. Specs
// are substrate-tagged — the dropdown filters to the active topology.

export async function saveCustomScenario(spec) {
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(SCENARIOS_STORE, 'readwrite');
            tx.objectStore(SCENARIOS_STORE).put({ ...spec, updatedAt: Date.now() }, spec.id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch {
        return false;
    }
}

export async function listCustomScenarios() {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(SCENARIOS_STORE, 'readonly').objectStore(SCENARIOS_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return [];
    }
}

export async function getCustomScenario(id) {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const req = db.transaction(SCENARIOS_STORE, 'readonly').objectStore(SCENARIOS_STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function deleteCustomScenario(id) {
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(SCENARIOS_STORE, 'readwrite');
            tx.objectStore(SCENARIOS_STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        return true;
    } catch {
        return false;
    }
}

// Versioned file interchange — download/upload a spec as portable JSON.
export function exportScenarioFile(spec) {
    return new Blob([exportSpec(spec)], { type: 'application/json' });
}

export function importScenarioFile(text) {
    const spec = importSpec(text);
    if (!spec.id) spec.id = `c${Date.now().toString(36)}`;
    return spec;
}
