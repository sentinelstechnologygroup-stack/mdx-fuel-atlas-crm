// tests/entityAdapter.emulator.test.js
import { deleteDoc, doc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  signInWithFirebase,
  signOutFromFirebase,
} from '@/auth/firebaseAuthService';
import { firestore } from '@/firebase/client';
import { createFirestoreEntity } from '@/firebase/entityAdapter';

const TEST_EMAIL = 'salesperson@example.test';
const TEST_PASSWORD = 'AtlasTest!2026';
const TEST_ENTITY = 'Phase3AdapterTest';

const entity = createFirestoreEntity(TEST_ENTITY);
const createdRecordIds = new Set();

beforeAll(async () => {
  const session = await signInWithFirebase(TEST_EMAIL, TEST_PASSWORD);

  expect(session.profile.role).toBe('salesperson');
  expect(session.profile.status).toBe('active');
});

afterAll(async () => {
  for (const recordId of createdRecordIds) {
    await deleteDoc(
      doc(
        firestore,
        'entities',
        TEST_ENTITY,
        'records',
        recordId
      )
    ).catch(() => undefined);
  }

  await signOutFromFirebase();
});

describe('Firestore entity adapter emulator integration', () => {
  it('creates and reads a record', async () => {
    const created = await entity.create({
      name: 'Adapter Create Test',
      status: 'new',
      owner_user_id: 'salesperson-user',
      removable_value: undefined,
    });

    createdRecordIds.add(created.id);

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Adapter Create Test');
    expect(created).not.toHaveProperty('removable_value');

    const stored = await entity.get(created.id);

    expect(stored.id).toBe(created.id);
    expect(stored.status).toBe('new');
    expect(stored.created_date).toBeTruthy();
    expect(stored.updated_date).toBeTruthy();
    expect(stored).not.toHaveProperty('removable_value');
  });

  it('updates and reads records using Base44-compatible read signatures', async () => {
    const created = await entity.create({
      name: 'Adapter Update Test',
      status: 'new',
      score: 10,
    });

    createdRecordIds.add(created.id);

    const updated = await entity.update(created.id, {
      status: 'qualified',
      score: 25,
    });

    expect(updated.status).toBe('qualified');
    expect(updated.score).toBe(25);

    const readById = await entity.read(created.id);
    const readByReference = await entity.read({ id: created.id });

    expect(readById.id).toBe(created.id);
    expect(readByReference.id).toBe(created.id);
  });

  it('supports list sorting and limits', async () => {
    const first = await entity.create({
      name: 'Adapter Sort A',
      sort_order: 1,
    });
    const second = await entity.create({
      name: 'Adapter Sort B',
      sort_order: 2,
    });
    const third = await entity.create({
      name: 'Adapter Sort C',
      sort_order: 3,
    });

    [first, second, third].forEach((record) =>
      createdRecordIds.add(record.id)
    );

    const results = await entity.list('-sort_order', 2);

    expect(results).toHaveLength(2);
    expect(results[0].sort_order).toBe(3);
    expect(results[1].sort_order).toBe(2);
  });

  it('supports filters and compatibility operators', async () => {
    const records = await entity.bulkCreate([
      {
        name: 'North Houston Fuel',
        status: 'active',
        score: 90,
        tags: ['diesel', 'priority'],
      },
      {
        name: 'Central Texas Fuel',
        status: 'inactive',
        score: 50,
        tags: ['gasoline'],
      },
      {
        name: 'Houston Fleet Services',
        status: 'active',
        score: 75,
        tags: ['diesel'],
      },
    ]);

    records.forEach((record) => createdRecordIds.add(record.id));

    const active = await entity.filter(
      { status: 'active' },
      '-score',
      10
    );
    const highScores = await entity.filter({
      score: { $gte: 75 },
    });
    const selectedStatuses = await entity.filter({
      status: { $in: ['active'] },
    });
    const nameContains = await entity.filter({
      name: { $contains: 'houston' },
    });
    const tagContains = await entity.filter({
      tags: { $contains: 'diesel' },
    });

    expect(active.map((record) => record.score)).toEqual([90, 75]);
    expect(highScores).toHaveLength(2);
    expect(selectedStatuses).toHaveLength(2);
    expect(nameContains).toHaveLength(2);
    expect(tagContains).toHaveLength(2);
  });

  it('supports bulk creation and deletion', async () => {
    const created = await entity.bulkCreate([
      { name: 'Bulk Test 1' },
      { name: 'Bulk Test 2' },
    ]);

    created.forEach((record) => createdRecordIds.add(record.id));

    expect(created).toHaveLength(2);

    const deletionResult = await entity.delete(created[0].id);
    createdRecordIds.delete(created[0].id);

    expect(deletionResult).toEqual({
      id: created[0].id,
      deleted: true,
    });

    const deletedRecord = await entity.get(created[0].id);

    expect(deletedRecord).toBeNull();
  });

  it('returns a default schema for unregistered entities', async () => {
    const schema = await entity.schema();

    expect(schema).toEqual({
      name: TEST_ENTITY,
      properties: {},
    });
  });
});
