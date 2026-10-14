import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import templateConfig from '../../firebase-applet-config.template.json';
import { Note } from '../types/note';

type FirebaseConfig = typeof templateConfig;
let localConfig: Partial<FirebaseConfig> = {};

try {
  const localModules = import.meta.glob('../../firebase-applet-config.json', {
    eager: true,
  });
  const localKey = '../../firebase-applet-config.json';
  if (localModules[localKey]) {
    localConfig = (localModules[localKey] as { default: FirebaseConfig }).default || {};
  }
} catch {
  // Ignored if local untracked config is absent
}

const firebaseConfig: FirebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId || templateConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId || templateConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey || templateConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain || templateConfig.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || templateConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || templateConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId || templateConfig.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localConfig.measurementId || templateConfig.measurementId || '',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || localConfig.oAuthClientId || templateConfig.oAuthClientId,
  recaptchaSiteKey: localConfig.recaptchaSiteKey || templateConfig.recaptchaSiteKey || '',
};

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using local mode.');
    }
    return false;
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Failed to sign in with Google:', err);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Failed to sign out:', err);
  }
}

export {
  onAuthStateChanged,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
};
