// src/firebase/entityAdapter.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { firestore } from './client';

const ENTITY_ROOT_COLLECTION = 'entities';
const DEFAULT_LIST_LIMIT = 500;
const MAX_BULK_WRITE_SIZE = 450;

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

async function readAllRecords(entityName) {
  const snapshot = await getDocs(getEntityCollection(entityName));

  return snapshot.docs.map((recordSnapshot) => ({
    id: recordSnapshot.id,
    ...recordSnapshot.data(),
  }));
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
  const now = serverTimestamp();

  const documentReference = await addDoc(getEntityCollection(entityName), {
    ...cleanedData,
    created_date: cleanedData.created_date ?? now,
    updated_date: now,
  });

  return {
    id: documentReference.id,
    ...cleanedData,
  };
}

async function updateRecord(entityName, recordId, data = {}) {
  const cleanedData = removeUndefinedValues(data) ?? {};
  const documentReference = getEntityDocument(entityName, recordId);

  await setDoc(
    documentReference,
    {
      ...cleanedData,
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
      const documentReference = doc(getEntityCollection(entityName));
      const now = serverTimestamp();

      batch.set(documentReference, {
        ...cleanedData,
        created_date: cleanedData.created_date ?? now,
        updated_date: now,
      });

      chunkResults.push({
        id: documentReference.id,
        ...cleanedData,
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
