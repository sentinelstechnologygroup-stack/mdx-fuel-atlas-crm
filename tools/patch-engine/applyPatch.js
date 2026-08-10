import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {applyPatch} from './patchEngine.js';
import {
  ACT_NOW_PATH,
  validateRepository,
} from './validateRepository.js';

const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/i.test(name)) throw new Error('Usage: node tools/patch-engine/applyPatch.js <patch-name>');
const root = process.cwd();
const {default: definition} = await import(pathToFileURL(path.join(root, 'tools/patch-engine/patches', `${name}.js`)).href);
if (definition.files.some((file) => file.path === ACT_NOW_PATH)) {
  throw new Error(`${ACT_NOW_PATH} is protected and cannot be patched.`);
}
const before = await validateRepository(root, {
  allowedChanges: [
    'tools/patch-engine',
    ...(definition.preExistingChanges ?? []),
  ],
  requireClean: definition.requireClean ?? false,
});
if (definition.expectedHead && definition.expectedHead !== before.head) throw new Error(`HEAD mismatch: expected ${definition.expectedHead}, received ${before.head}`);
const result = await applyPatch({root, ...definition});
const after = await validateRepository(root, {
  allowedChanges: [
    'tools/patch-engine',
    ...(definition.preExistingChanges ?? []),
    ...definition.files.map((file) => file.path),
  ],
});
console.log(JSON.stringify({patch: definition.id, branch: after.branch, head: after.head, files: result}, null, 2));
