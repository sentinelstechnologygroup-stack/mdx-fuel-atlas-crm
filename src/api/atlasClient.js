// src/api/atlasClient.js
import { httpsCallable } from 'firebase/functions';

import {
  getUserProfile,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import {
  firebaseAuth,
  firebaseFunctions,
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
  requireCurrentFirebaseUser();

  const callable = httpsCallable(
    firebaseFunctions,
    'updateCurrentProfile'
  );

  const response = await callable(data);

  return response?.data?.user || getCurrentProfile();
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
    invoke: async (functionName, data = {}) => {
      if (
        typeof functionName !== 'string' ||
        functionName.trim().length === 0
      ) {
        throw new Error('A Firebase callable function name is required.');
      }

      const callable = httpsCallable(
        firebaseFunctions,
        functionName.trim()
      );

      return callable(data);
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
