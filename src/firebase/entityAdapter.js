// src/firebase/entityAdapter.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { USER_ROLES } from '@/auth/constants';
import { getUserProfile } from '@/auth/firebaseAuthService';
import { firebaseAuth, firestore } from './client';

const ENTITY_ROOT_COLLECTION = 'entities';
const DEFAULT_LIST_LIMIT = 500;
const MAX_BULK_WRITE_SIZE = 450;

const RECORD_SCOPED_ENTITIES = new Set([
  'Activity',
  'Client',
  'Lead',
  'Opportunity',
  'Task',
]);

const SELF_OWNED_ENTITIES = new Set([
  'Notification',
  'NotificationSettings',
]);

const schemaRegistry = new Map();

function assertEntityName(entityName) {
  if (typeof entityName !== 'string' || entityName.trim() === '') {
    throw new Error('A valid entity name is required.');
  }

  return entityName.trim();
}

function getEntityCollection(entityName) {
  const validEntityName = assertEntityName(entityName);

  return collection(
    firestore,
    ENTITY_ROOT_COLLECTION,
    validEntityName,
    'records'
  );
}

function getEntityDocument(entityName, recordId) {
  if (typeof recordId !== 'string' || recordId.trim() === '') {
    throw new Error(`A valid record ID is required for ${entityName}.`);
  }

  return doc(getEntityCollection(entityName), recordId.trim());
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function removeUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value
      .map(removeUndefinedValues)
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce((result, [key, item]) => {
      const cleanedItem = removeUndefinedValues(item);

      if (cleanedItem !== undefined) {
        result[key] = cleanedItem;
      }

      return result;
    }, {});
  }

  return value === undefined ? undefined : value;
}

function normalizeRecord(snapshot) {
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function normalizeComparableValue(value) {
  if (value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return value;
}

function valuesEqual(left, right) {
  return normalizeComparableValue(left) === normalizeComparableValue(right);
}

function matchesOperator(actualValue, operatorExpression) {
  return Object.entries(operatorExpression).every(([operator, expectedValue]) => {
    switch (operator) {
      case '$in':
        return (
          Array.isArray(expectedValue) &&
          expectedValue.some((candidate) => valuesEqual(actualValue, candidate))
        );

      case '$nin':
        return (
          Array.isArray(expectedValue) &&
          !expectedValue.some((candidate) => valuesEqual(actualValue, candidate))
        );

      case '$ne':
        return !valuesEqual(actualValue, expectedValue);

      case '$gt':
        return (
          normalizeComparableValue(actualValue) >
          normalizeComparableValue(expectedValue)
        );

      case '$gte':
        return (
          normalizeComparableValue(actualValue) >=
          normalizeComparableValue(expectedValue)
        );

      case '$lt':
        return (
          normalizeComparableValue(actualValue) <
          normalizeComparableValue(expectedValue)
        );

      case '$lte':
        return (
          normalizeComparableValue(actualValue) <=
          normalizeComparableValue(expectedValue)
        );

      case '$contains':
        return Array.isArray(actualValue)
          ? actualValue.some((item) => valuesEqual(item, expectedValue))
          : String(actualValue ?? '')
              .toLowerCase()
              .includes(String(expectedValue ?? '').toLowerCase());

      default:
        return false;
    }
  });
}

function recordMatchesFilter(record, filter) {
  if (!isPlainObject(filter) || Object.keys(filter).length === 0) {
    return true;
  }

  return Object.entries(filter).every(([fieldName, expectedValue]) => {
    const actualValue = record[fieldName];

    if (isPlainObject(expectedValue)) {
      return matchesOperator(actualValue, expectedValue);
    }

    if (Array.isArray(expectedValue)) {
      return expectedValue.some((candidate) =>
        valuesEqual(actualValue, candidate)
      );
    }

    return valuesEqual(actualValue, expectedValue);
  });
}

function parseSort(sortValue) {
  if (typeof sortValue !== 'string' || sortValue.trim() === '') {
    return null;
  }

  const trimmedSort = sortValue.trim();
  const descending = trimmedSort.startsWith('-');
  const fieldName = descending ? trimmedSort.slice(1) : trimmedSort;

  if (!fieldName) {
    return null;
  }

  return {
    fieldName,
    direction: descending ? 'desc' : 'asc',
  };
}

function sortRecords(records, sortValue) {
  const sortConfig = parseSort(sortValue);

  if (!sortConfig) {
    return records;
  }

  const { fieldName, direction } = sortConfig;
  const multiplier = direction === 'desc' ? -1 : 1;

  return [...records].sort((left, right) => {
    const leftValue = normalizeComparableValue(left[fieldName]);
    const rightValue = normalizeComparableValue(right[fieldName]);

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === null || leftValue === undefined) {
      return 1;
    }

    if (rightValue === null || rightValue === undefined) {
      return -1;
    }

    return leftValue > rightValue ? multiplier : -multiplier;
  });
}

function normalizeLimit(limitValue, fallback = DEFAULT_LIST_LIMIT) {
  const numericLimit = Number(limitValue);

  if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
    return fallback;
  }

  return Math.floor(numericLimit);
}

function parseListArguments(firstArgument, secondArgument) {
  if (typeof firstArgument === 'number') {
    return {
      filter: {},
      sort: null,
      limit: normalizeLimit(firstArgument),
    };
  }

  if (isPlainObject(firstArgument)) {
    return {
      filter: firstArgument,
      sort: null,
      limit: normalizeLimit(secondArgument),
    };
  }

  return {
    filter: {},
    sort: typeof firstArgument === 'string' ? firstArgument : null,
    limit: normalizeLimit(secondArgument),
  };
}

function parseFilterArguments(filter, sortOrLimit, maybeLimit) {
  if (typeof sortOrLimit === 'number') {
    return {
      filter: isPlainObject(filter) ? filter : {},
      sort: null,
      limit: normalizeLimit(sortOrLimit),
    };
  }

  return {
    filter: isPlainObject(filter) ? filter : {},
    sort: typeof sortOrLimit === 'string' ? sortOrLimit : null,
    limit: normalizeLimit(maybeLimit),
  };
}

async function getCurrentAuthorizationProfile(entityName) {
  const requiresAuthorization =
    RECORD_SCOPED_ENTITIES.has(entityName) ||
    SELF_OWNED_ENTITIES.has(entityName);

  if (!requiresAuthorization) {
    return null;
  }

  const currentUser = firebaseAuth.currentUser;

  if (!currentUser) {
    throw new Error(
      `An authenticated Firebase user is required to access ${entityName} records.`
    );
  }

  return getUserProfile(currentUser.uid);
}

function recordsFromSnapshot(snapshot) {
  return snapshot.docs.map((recordSnapshot) => ({
    id: recordSnapshot.id,
    ...recordSnapshot.data(),
  }));
}

function mergeRecordSets(recordSets) {
  const recordsById = new Map();

  recordSets.flat().forEach((record) => {
    recordsById.set(record.id, record);
  });

  return [...recordsById.values()];
}

function buildScopedReadQueries(entityName, profile) {
  const entityCollection = getEntityCollection(entityName);

  if (!profile) {
    return [entityCollection];
  }

  if (SELF_OWNED_ENTITIES.has(entityName)) {
    const selfOwnedQueries = [
      query(
        entityCollection,
        where('user_id', '==', profile.uid)
      ),
    ];

    if (
      typeof profile.email === 'string' &&
      profile.email.trim() !== ''
    ) {
      selfOwnedQueries.push(
        query(
          entityCollection,
          where('user_email', '==', profile.email.trim())
        )
      );
    }

    return selfOwnedQueries;
  }

  switch (profile.application_role) {
    case USER_ROLES.SUPER_ADMIN:
    case USER_ROLES.ADMINISTRATOR:
      return [entityCollection];

    case USER_ROLES.SALESPERSON:
      return [
        query(
          entityCollection,
          where('owner_user_id', '==', profile.uid)
        ),
      ];

    case USER_ROLES.SUPERVISOR: {
      const scopedQueries = [
        query(
          entityCollection,
          where('owner_user_id', '==', profile.uid)
        ),
        query(
          entityCollection,
          where('assigned_supervisor_user_id', '==', profile.uid)
        ),
      ];

      if (profile.team_id) {
        scopedQueries.push(
          query(
            entityCollection,
            where('assigned_team_id', '==', profile.team_id)
          )
        );
      }

      return scopedQueries;
    }

    case USER_ROLES.VIEWER_SUPPORT:
      return [];

    default:
      throw new Error(
        `Role "${profile.application_role}" cannot list ${entityName} records.`
      );
  }
}

function defaultTerritoryId(profile) {
  return Array.isArray(profile?.territory_ids) &&
    profile.territory_ids.length === 1
    ? profile.territory_ids[0]
    : null;
}

function applyCreateAuthorizationFields(entityName, data, profile) {
  if (!profile) {
    return data;
  }

  if (SELF_OWNED_ENTITIES.has(entityName)) {
    if (
      typeof profile.email !== 'string' ||
      profile.email.trim() === ''
    ) {
      throw new Error(
        `An employee email is required to create ${entityName} records.`
      );
    }

    return {
      ...data,
      user_id: profile.uid,
      user_email: profile.email.trim(),
      created_by_user_id: profile.uid,
      last_modified_by_user_id: profile.uid,
    };
  }

  if (!RECORD_SCOPED_ENTITIES.has(entityName)) {
    return data;
  }

  const requestedTerritoryId = data.territory_id ?? null;
  const territoryId =
    defaultTerritoryId(profile) ??
    requestedTerritoryId;

  const auditFields = {
    created_by_user_id: profile.uid,
    last_modified_by_user_id: profile.uid,
  };

  switch (profile.application_role) {
    case USER_ROLES.SALESPERSON:
      return {
        ...data,
        owner_user_id: profile.uid,
        assigned_team_id: profile.team_id ?? null,
        assigned_supervisor_user_id:
          profile.supervisor_user_id ?? null,
        territory_id: territoryId,
        ownership_status: 'assigned',
        ...auditFields,
      };

    case USER_ROLES.SUPERVISOR: {
      const requestedOwnerId =
        typeof data.owner_user_id === 'string' &&
        data.owner_user_id.trim() !== ''
          ? data.owner_user_id.trim()
          : profile.uid;

      return {
        ...data,
        owner_user_id: requestedOwnerId,
        assigned_team_id: profile.team_id ?? null,
        assigned_supervisor_user_id: profile.uid,
        territory_id: territoryId,
        ownership_status: 'assigned',
        ...auditFields,
      };
    }

    case USER_ROLES.ADMINISTRATOR:
    case USER_ROLES.SUPER_ADMIN: {
      const ownerUserId = data.owner_user_id ?? null;

      return {
        ...data,
        ownership_status:
          data.ownership_status ??
          (ownerUserId ? 'assigned' : 'unassigned'),
        ...auditFields,
      };
    }

    case USER_ROLES.VIEWER_SUPPORT:
      throw new Error(
        `Viewer Support cannot create ${entityName} records.`
      );

    default:
      throw new Error(
        `Role "${profile.application_role}" cannot create ${entityName} records.`
      );
  }
}

async function readAllRecords(entityName) {
  const profile = await getCurrentAuthorizationProfile(entityName);
  const scopedQueries = buildScopedReadQueries(entityName, profile);

  if (scopedQueries.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    scopedQueries.map((scopedQuery) => getDocs(scopedQuery))
  );

  return mergeRecordSets(
    snapshots.map((snapshot) => recordsFromSnapshot(snapshot))
  );
}

async function listRecords(entityName, firstArgument, secondArgument) {
  const options = parseListArguments(firstArgument, secondArgument);
  const records = await readAllRecords(entityName);

  return sortRecords(
    records.filter((record) => recordMatchesFilter(record, options.filter)),
    options.sort
  ).slice(0, options.limit);
}

async function filterRecords(
  entityName,
  filter,
  sortOrLimit,
  maybeLimit
) {
  const options = parseFilterArguments(filter, sortOrLimit, maybeLimit);
  const records = await readAllRecords(entityName);

  return sortRecords(
    records.filter((record) => recordMatchesFilter(record, options.filter)),
    options.sort
  ).slice(0, options.limit);
}

async function getRecord(entityName, recordId) {
  const snapshot = await getDoc(getEntityDocument(entityName, recordId));
  return normalizeRecord(snapshot);
}

async function readRecord(entityName, reference) {
  const recordId =
    typeof reference === 'string'
      ? reference
      : reference?.id;

  const record = await getRecord(entityName, recordId);

  if (!record) {
    throw new Error(`${entityName} record "${recordId}" was not found.`);
  }

  return record;
}

async function createRecord(entityName, data = {}) {
  const cleanedData = removeUndefinedValues(data) ?? {};
  const authorizationProfile =
    await getCurrentAuthorizationProfile(entityName);
  const authorizedData = applyCreateAuthorizationFields(
    entityName,
    cleanedData,
    authorizationProfile
  );
  const now = serverTimestamp();

  const documentReference = await addDoc(getEntityCollection(entityName), {
    ...authorizedData,
    created_date: authorizedData.created_date ?? now,
    updated_date: now,
  });

  return {
    id: documentReference.id,
    ...authorizedData,
  };
}

async function updateRecord(entityName, recordId, data = {}) {
  const cleanedData = removeUndefinedValues(data) ?? {};
  const authorizationProfile =
    await getCurrentAuthorizationProfile(entityName);

  let writeData = cleanedData;

  if (
    authorizationProfile &&
    SELF_OWNED_ENTITIES.has(entityName)
  ) {
    if (
      typeof authorizationProfile.email !== 'string' ||
      authorizationProfile.email.trim() === ''
    ) {
      throw new Error(
        `An employee email is required to update ${entityName} records.`
      );
    }

    writeData = {
      ...cleanedData,
      user_id: authorizationProfile.uid,
      user_email: authorizationProfile.email.trim(),
      last_modified_by_user_id: authorizationProfile.uid,
    };
  } else if (authorizationProfile) {
    writeData = {
      ...cleanedData,
      last_modified_by_user_id: authorizationProfile.uid,
    };
  }

  const documentReference = getEntityDocument(entityName, recordId);

  await setDoc(
    documentReference,
    {
      ...writeData,
      updated_date: serverTimestamp(),
    },
    { merge: true }
  );

  const updatedSnapshot = await getDoc(documentReference);

  return normalizeRecord(updatedSnapshot);
}

async function deleteRecord(entityName, recordId) {
  await deleteDoc(getEntityDocument(entityName, recordId));

  return {
    id: recordId,
    deleted: true,
  };
}

async function bulkCreateRecords(entityName, records = []) {
  if (!Array.isArray(records)) {
    throw new Error(`${entityName}.bulkCreate expects an array of records.`);
  }

  if (records.length === 0) {
    return [];
  }

  const authorizationProfile =
    await getCurrentAuthorizationProfile(entityName);
  const createdRecords = [];

  for (
    let startIndex = 0;
    startIndex < records.length;
    startIndex += MAX_BULK_WRITE_SIZE
  ) {
    const currentChunk = records.slice(
      startIndex,
      startIndex + MAX_BULK_WRITE_SIZE
    );

    const batch = writeBatch(firestore);
    const chunkResults = [];

    currentChunk.forEach((record) => {
      const cleanedData = removeUndefinedValues(record) ?? {};
      const authorizedData = applyCreateAuthorizationFields(
        entityName,
        cleanedData,
        authorizationProfile
      );
      const documentReference = doc(getEntityCollection(entityName));
      const now = serverTimestamp();

      batch.set(documentReference, {
        ...authorizedData,
        created_date: authorizedData.created_date ?? now,
        updated_date: now,
      });

      chunkResults.push({
        id: documentReference.id,
        ...authorizedData,
      });
    });

    await batch.commit();
    createdRecords.push(...chunkResults);
  }

  return createdRecords;
}

function getSchema(entityName) {
  return schemaRegistry.get(assertEntityName(entityName)) ?? {
    name: entityName,
    properties: {},
  };
}

export function registerEntitySchema(entityName, schema) {
  schemaRegistry.set(assertEntityName(entityName), schema);
}

export function createFirestoreEntity(entityName) {
  const validEntityName = assertEntityName(entityName);

  return Object.freeze({
    list: (firstArgument, secondArgument) =>
      listRecords(validEntityName, firstArgument, secondArgument),

    filter: (filter, sortOrLimit, maybeLimit) =>
      filterRecords(
        validEntityName,
        filter,
        sortOrLimit,
        maybeLimit
      ),

    get: (recordId) =>
      getRecord(validEntityName, recordId),

    read: (reference) =>
      readRecord(validEntityName, reference),

    create: (data) =>
      createRecord(validEntityName, data),

    bulkCreate: (records) =>
      bulkCreateRecords(validEntityName, records),

    update: (recordId, data) =>
      updateRecord(validEntityName, recordId, data),

    delete: (recordId) =>
      deleteRecord(validEntityName, recordId),

    schema: async () =>
      getSchema(validEntityName),
  });
}

export function createFirestoreEntityRegistry() {
  const entityCache = new Map();

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') {
          return undefined;
        }

        if (!entityCache.has(property)) {
          entityCache.set(property, createFirestoreEntity(property));
        }

        return entityCache.get(property);
      },

      has(_target, property) {
        return typeof property === 'string';
      },
    }
  );
}

export const firestoreEntities = createFirestoreEntityRegistry();
