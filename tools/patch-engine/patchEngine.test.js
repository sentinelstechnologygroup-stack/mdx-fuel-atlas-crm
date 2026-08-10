import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {applyPatch, sha256} from './patchEngine.js';

test('replaces exact content and backs up the original', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'patch-engine-'));
  await writeFile(path.join(root, 'example.txt'), 'alpha\nbeta\n');
  await applyPatch({root, id: 'replace', files: [{path: 'example.txt', expectedBeforeHash: sha256('alpha\nbeta\n'), operations: [{type: 'replace', anchor: 'beta', content: 'gamma'}]}]});
  assert.equal(await readFile(path.join(root, 'example.txt'), 'utf8'), 'alpha\ngamma\n');
  assert.equal(await readFile(path.join(root, '.patch-engine-backups/replace/example.txt.bak'), 'utf8'), 'alpha\nbeta\n');
});

test('rejects ambiguous anchors without changing the file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'patch-engine-'));
  const target = path.join(root, 'example.txt');
  await writeFile(target, 'same\nsame\n');
  await assert.rejects(applyPatch({root, id: 'ambiguous', files: [{path: 'example.txt', operations: [{type: 'delete', anchor: 'same'}]}]}), /exactly one anchor/);
  assert.equal(await readFile(target, 'utf8'), 'same\nsame\n');
});

test('rolls back all writes after failed verification', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'patch-engine-'));
  await writeFile(path.join(root, 'one.txt'), 'one\n');
  await writeFile(path.join(root, 'two.txt'), 'two\n');
  await assert.rejects(applyPatch({root, id: 'rollback', files: [
    {path: 'one.txt', operations: [{type: 'replace', anchor: 'one', content: 'changed'}]},
    {path: 'two.txt', expectedAfterHash: sha256('impossible\n'), operations: [{type: 'replace', anchor: 'two', content: 'changed'}]},
  ]}), /After hash mismatch/);
  assert.equal(await readFile(path.join(root, 'one.txt'), 'utf8'), 'one\n');
  assert.equal(await readFile(path.join(root, 'two.txt'), 'utf8'), 'two\n');
});
