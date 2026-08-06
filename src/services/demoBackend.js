import { buildDemoDocs, DEMO_USER } from './demoData';

// In-memory implementering av delmengden av Firestore/Auth-API-et appen bruker.
// Aktiveres i demo-modus (se backend.js) slik at appen kan kjøres uten Firebase-oppsett.
// Data lever kun i minnet og nullstilles ved refresh.

export const DEMO_STORAGE_KEY = 'family-dash-demo';

function demoFlagSet() {
    try {
        return localStorage.getItem(DEMO_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function demoRequestedInUrl() {
    try {
        return new URLSearchParams(window.location.search).get('demo') === '1';
    } catch {
        return false;
    }
}

// Demo kan aktiveres via «Prøv demo»-knappen (localStorage) eller direkte med ?demo=1 i URL-en.
export function demoActivated() {
    if (demoRequestedInUrl()) {
        try {
            localStorage.setItem(DEMO_STORAGE_KEY, '1');
        } catch {
            // localStorage utilgjengelig — URL-parameteren holder for denne økten
        }
        return true;
    }
    return demoFlagSet();
}

export const auth = { __demo: true };
export const db = { __demo: true };

// --- Dokumentlager -----------------------------------------------------------

const docStore = new Map(); // 'families/demo-familie/…' -> data-objekt
buildDemoDocs().forEach(([path, data]) => docStore.set(path, data));

const docListeners = new Map(); // dokumentsti -> Set<callback>
const collListeners = new Map(); // samlingssti -> Set<callback>

let idCounter = 0;
const autoId = () => `demo-auto-${++idCounter}`;

function splitPath(segments) {
    return segments
        .flatMap(s => String(s).split('/'))
        .filter(Boolean);
}

function parentPath(path) {
    return path.slice(0, path.lastIndexOf('/'));
}

function lastSegment(path) {
    return path.slice(path.lastIndexOf('/') + 1);
}

function makeDocRef(path) {
    return { __type: 'doc', path, id: lastSegment(path) };
}

function makeCollRef(path) {
    return { __type: 'collection', path };
}

function docSnapshot(path) {
    const data = docStore.get(path);
    return {
        id: lastSegment(path),
        ref: makeDocRef(path),
        exists: () => data !== undefined,
        data: () => (data === undefined ? undefined : { ...data })
    };
}

function matchesFilters(data, filters) {
    return filters.every(f => {
        if (f.op === '==') return data?.[f.field] === f.value;
        return true;
    });
}

function collSnapshot(path, filters = []) {
    const prefix = path + '/';
    const snapDocs = [];
    for (const [docPath, data] of docStore) {
        if (docPath.startsWith(prefix) && !docPath.slice(prefix.length).includes('/') && matchesFilters(data, filters)) {
            snapDocs.push(docSnapshot(docPath));
        }
    }
    return {
        docs: snapDocs,
        empty: snapDocs.length === 0,
        size: snapDocs.length,
        metadata: { fromCache: false }
    };
}

function notify(docPath) {
    docListeners.get(docPath)?.forEach(cb => cb(docSnapshot(docPath)));
    const parent = parentPath(docPath);
    collListeners.get(parent)?.forEach(cb => cb(collSnapshot(parent)));
}

// --- Sentinel-verdier --------------------------------------------------------

const DELETE_SENTINEL = Symbol('deleteField');

export function deleteField() {
    return DELETE_SENTINEL;
}

export function serverTimestamp() {
    return new Date();
}

export function arrayUnion(...items) {
    return { __arrayUnion: items };
}

function applyValues(target, values) {
    Object.entries(values).forEach(([key, value]) => {
        if (value === DELETE_SENTINEL) {
            delete target[key];
        } else if (value && typeof value === 'object' && Array.isArray(value.__arrayUnion)) {
            const existing = Array.isArray(target[key]) ? target[key] : [];
            target[key] = [...existing, ...value.__arrayUnion];
        } else {
            target[key] = value;
        }
    });
    return target;
}

// --- Firestore-API -----------------------------------------------------------

export function doc(parent, ...segments) {
    if (parent?.__type === 'collection' && segments.length === 0) {
        return makeDocRef(`${parent.path}/${autoId()}`);
    }
    if (parent?.__type === 'collection') {
        return makeDocRef([parent.path, ...splitPath(segments)].join('/'));
    }
    return makeDocRef(splitPath(segments).join('/'));
}

export function collection(parent, ...segments) {
    const base = parent?.__type ? [parent.path] : [];
    return makeCollRef([...base, ...splitPath(segments)].join('/'));
}

export function query(collRef, ...constraints) {
    return { __type: 'query', path: collRef.path, filters: constraints.filter(c => c?.__type === 'where') };
}

export function where(field, op, value) {
    return { __type: 'where', field, op, value };
}

export function onSnapshot(ref, callback) {
    if (ref.__type === 'doc') {
        if (!docListeners.has(ref.path)) docListeners.set(ref.path, new Set());
        docListeners.get(ref.path).add(callback);
        Promise.resolve().then(() => callback(docSnapshot(ref.path)));
        return () => docListeners.get(ref.path)?.delete(callback);
    }
    const wrapped = ref.__type === 'query'
        ? () => callback(collSnapshot(ref.path, ref.filters))
        : () => callback(collSnapshot(ref.path));
    if (!collListeners.has(ref.path)) collListeners.set(ref.path, new Set());
    collListeners.get(ref.path).add(wrapped);
    Promise.resolve().then(wrapped);
    return () => collListeners.get(ref.path)?.delete(wrapped);
}

export async function getDoc(ref) {
    return docSnapshot(ref.path);
}

export async function getDocs(ref) {
    return collSnapshot(ref.path, ref.__type === 'query' ? ref.filters : []);
}

export async function setDoc(ref, data, options = {}) {
    const base = options.merge ? { ...(docStore.get(ref.path) || {}) } : {};
    docStore.set(ref.path, applyValues(base, data));
    notify(ref.path);
}

export async function updateDoc(ref, updates) {
    const existing = { ...(docStore.get(ref.path) || {}) };
    docStore.set(ref.path, applyValues(existing, updates));
    notify(ref.path);
}

export async function addDoc(collRef, data) {
    const ref = makeDocRef(`${collRef.path}/${autoId()}`);
    docStore.set(ref.path, applyValues({}, data));
    notify(ref.path);
    return ref;
}

export async function deleteDoc(ref) {
    docStore.delete(ref.path);
    notify(ref.path);
}

export function writeBatch() {
    const ops = [];
    return {
        set: (ref, data, options) => ops.push(() => setDoc(ref, data, options)),
        update: (ref, updates) => ops.push(() => updateDoc(ref, updates)),
        delete: (ref) => ops.push(() => deleteDoc(ref)),
        commit: async () => {
            for (const op of ops) await op();
        }
    };
}

// --- Auth-API ----------------------------------------------------------------

let currentUser = demoActivated() ? DEMO_USER : null;
const authListeners = new Set();

export function onAuthStateChanged(_auth, callback) {
    authListeners.add(callback);
    Promise.resolve().then(() => callback(currentUser));
    return () => authListeners.delete(callback);
}

export async function signOut() {
    try {
        localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
        // localStorage utilgjengelig — demoen avsluttes uansett i minnet
    }
    currentUser = null;
    authListeners.forEach(cb => cb(null));
}

const DEMO_AUTH_ERROR = 'Innlogging er ikke tilgjengelig i demo-modus. Bruk «Prøv demo»-knappen i stedet.';

export async function signInWithEmailAndPassword() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function createUserWithEmailAndPassword() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function signInWithPopup() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function sendPasswordResetEmail() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function updatePassword() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function deleteUser() {
    throw new Error(DEMO_AUTH_ERROR);
}

export async function reauthenticateWithCredential() {
    throw new Error(DEMO_AUTH_ERROR);
}

export class GoogleAuthProvider {}

export const EmailAuthProvider = {
    credential: () => ({ __demo: true })
};
