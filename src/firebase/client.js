// src/firebase/client.js
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (requiredConfig.length > 0) {
  throw new Error(
    `Missing Firebase browser configuration: ${requiredConfig.join(', ')}`
  );
}

export const firebaseApp = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

const shouldUseEmulators =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

if (shouldUseEmulators && !globalThis.__MDX_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199);
  globalThis.__MDX_FIREBASE_EMULATORS_CONNECTED__ = true;
}
