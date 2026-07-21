// src/api/atlasClient.js
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  getUserProfile,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import {
  firebaseAuth,
  firestore,
} from '@/firebase/client';
import { firestoreEntities } from '@/firebase/entityAdapter';

function requireCurrentFirebaseUser() {
  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    throw new Error('No authenticated Firebase user is available.');
  }

  return currentUser;
}

async function getCurrentProfile() {
  const currentUser = requireCurrentFirebaseUser();
  return getUserProfile(currentUser.uid);
}

async function updateCurrentProfile(data = {}) {
  const currentUser = requireCurrentFirebaseUser();

  await setDoc(
    doc(firestore, 'userProfiles', currentUser.uid),
    {
      ...data,
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );

  return getUserProfile(currentUser.uid);
}

function createUnsupportedOperation(category, operationName) {
  return async () => {
    throw new Error(
      `ATLAS ${category} operation "${operationName}" has not yet been migrated to Firebase.`
    );
  };
}

const unsupportedCore = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }

      return createUnsupportedOperation('integration', property);
    },
  }
);

const unsupportedAgents = new Proxy(
  {},
  {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }

      return createUnsupportedOperation('agent', property);
    },
  }
);

export const atlas = Object.freeze({
  // Firebase-backed ATLAS application API.
  entities: firestoreEntities,

  auth: Object.freeze({
    me: getCurrentProfile,
    updateMe: updateCurrentProfile,
    logout: signOutFromFirebase,
    redirectToLogin: async () => {
      await signOutFromFirebase();

      if (typeof window !== 'undefined') {
        window.location.assign('/');
      }
    },
  }),

  functions: Object.freeze({
    invoke: async (functionName) => {
      throw new Error(
        `ATLAS function "${functionName}" has not yet been migrated to Firebase Functions.`
      );
    },
  }),

  integrations: Object.freeze({
    Core: unsupportedCore,
  }),

  agents: unsupportedAgents,

  // Prevent disabled usage tracking from generating failed network traffic.
  appLogs: Object.freeze({
    logUserInApp: async () => ({
      logged: false,
      provider: 'firebase',
    }),
  }),
});

