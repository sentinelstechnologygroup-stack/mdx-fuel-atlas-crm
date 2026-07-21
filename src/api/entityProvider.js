// src/api/entityProvider.js
import { firestoreEntities } from '@/firebase/entityAdapter';

// Temporary compatibility export.
// All entity access is now Firestore-only. There is no legacy fallback.
export function createEntityProvider() {
  return firestoreEntities;
}

export function getEntityProviderStatus(entityName) {
  return {
    entityName,
    configuredProvider: 'firestore',
    provider: 'firestore',
    firestoreAllowlisted: true,
  };
}
