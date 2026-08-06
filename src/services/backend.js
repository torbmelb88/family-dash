import * as firestoreSdk from 'firebase/firestore';
import * as authSdk from 'firebase/auth';
import { isFirebaseConfigured, auth as firebaseAuth, db as firebaseDb } from './firebase';
import * as demoBackend from './demoBackend';
import { DEMO_STORAGE_KEY } from './demoBackend';

// Felles inngangsport til backend: delegér til ekte Firebase når appen er
// konfigurert, ellers til in-memory demo-backenden. Valget tas ved oppstart;
// demo aktiveres/deaktiveres derfor med full sidelasting (se enableDemo/signOut).

export const isDemo = demoBackend.demoActivated() || !isFirebaseConfigured;
export { isFirebaseConfigured };

export function enableDemo() {
    try {
        localStorage.setItem(DEMO_STORAGE_KEY, '1');
    } catch {
        // localStorage utilgjengelig — demo virker likevel så lenge Firebase ikke er konfigurert
    }
    window.location.assign('/');
}

const fs = isDemo ? demoBackend : firestoreSdk;
const fa = isDemo ? demoBackend : authSdk;

export const auth = isDemo ? demoBackend.auth : firebaseAuth;
export const db = isDemo ? demoBackend.db : firebaseDb;

// Firestore
export const doc = fs.doc;
export const collection = fs.collection;
export const query = fs.query;
export const where = fs.where;
export const onSnapshot = fs.onSnapshot;
export const getDoc = fs.getDoc;
export const getDocs = fs.getDocs;
export const setDoc = fs.setDoc;
export const updateDoc = fs.updateDoc;
export const addDoc = fs.addDoc;
export const deleteDoc = fs.deleteDoc;
export const writeBatch = fs.writeBatch;
export const deleteField = fs.deleteField;
export const serverTimestamp = fs.serverTimestamp;
export const arrayUnion = fs.arrayUnion;

// Auth
export const onAuthStateChanged = fa.onAuthStateChanged;
export const signInWithEmailAndPassword = fa.signInWithEmailAndPassword;
export const createUserWithEmailAndPassword = fa.createUserWithEmailAndPassword;
export const signInWithPopup = fa.signInWithPopup;
export const signOut = fa.signOut;
export const sendPasswordResetEmail = fa.sendPasswordResetEmail;
export const updatePassword = fa.updatePassword;
export const deleteUser = fa.deleteUser;
export const reauthenticateWithCredential = fa.reauthenticateWithCredential;
export const GoogleAuthProvider = fa.GoogleAuthProvider;
export const EmailAuthProvider = fa.EmailAuthProvider;
