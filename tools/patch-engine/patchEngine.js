import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

export const sha256 = (content) => createHash('sha256').update(content).digest('hex').toUpperCase();

function transform(content, operation) {
  if (!operation.anchor) throw new Error('Patch anchors cannot be empty.');
  const count = content.split(operation.anchor).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one anchor for ${operation.type}; found ${count}.`);
  if ((operation.content ?? '').includes('\r')) throw new Error('Patch content must use LF line endings.');
  if (operation.type === 'replace') return content.replace(operation.anchor, operation.content);
  if (operation.type === 'insertBefore') return content.replace(operation.anchor, `${operation.content}${operation.anchor}`);
  if (operation.type === 'insertAfter') return content.replace(operation.anchor, `${operation.anchor}${operation.content}`);
  if (operation.type === 'delete') return content.replace(operation.anchor, '');
  throw new Error(`Unsupported patch operation: ${operation.type}`);
}

async function safeTarget(root, relativePath, allowMissing) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`Path must be repository-relative: ${relativePath}`);
  const rootPath = await realpath(root);
  const target = path.resolve(rootPath, relativePath);
  const prefix = `${rootPath}${path.sep}`;
  if (!target.startsWith(prefix)) throw new Error(`Path escapes repository root: ${relativePath}`);
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Target must be a regular file: ${relativePath}`);
    if (!(await realpath(target)).startsWith(prefix)) throw new Error(`Target resolves outside repository: ${relativePath}`);
  } catch (error) {
    if (!allowMissing || error.code !== 'ENOENT') throw error;
  }
  return target;
}

async function readUtf8(file) {
  const buffer = await readFile(file);
  const content = buffer.toString('utf8');
  if (content.startsWith('\uFEFF') || Buffer.from(content).compare(buffer) !== 0) throw new Error(`File must be UTF-8 without BOM: ${file}`);
  return content;
}

async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.patch-engine-${process.pid}.tmp`;
  await writeFile(temporary, content, {encoding: 'utf8', flag: 'wx'});
  try { await rename(temporary, file); } catch (error) { await rm(temporary, {force: true}); throw error; }
}

export async function applyPatch({root, id, files, backupRoot = '.patch-engine-backups'}) {
  if (!id || !files?.length) throw new Error('Patch id and files are required.');
  const prepared = [];
  for (const file of files) {
    const target = await safeTarget(root, file.path, file.create === true);
    let before = null;
    try { before = await readUtf8(target); } catch (error) { if (!(file.create && error.code === 'ENOENT')) throw error; }
    if (file.expectedBeforeHash && sha256(before ?? '') !== file.expectedBeforeHash.toUpperCase()) throw new Error(`Before hash mismatch: ${file.path}`);
    let after = before ?? '';
    for (const operation of file.operations ?? []) after = transform(after, operation);
    if (file.content !== undefined) {
      if (before !== null && file.create) throw new Error(`Create target already exists: ${file.path}`);
      if (file.content.includes('\r')) throw new Error('Patch content must use LF line endings.');
      after = file.content;
    }
    if (after === before) throw new Error(`Patch produced no change: ${file.path}`);
    prepared.push({file, target, before, after});
  }
  const applied = [];
  try {
    for (const item of prepared) {
      if (item.before !== null) {
        const backupPath = path.join(
          root,
          backupRoot,
          id,
          `${item.file.path}.bak`,
        );
        await atomicWrite(backupPath, item.before);
      }
      await atomicWrite(item.target, item.after);
      applied.push(item);
      if (item.file.expectedAfterHash && sha256(await readUtf8(item.target)) !== item.file.expectedAfterHash.toUpperCase()) throw new Error(`After hash mismatch: ${item.file.path}`);
    }
  } catch (error) {
    for (const item of applied.reverse()) item.before === null ? await rm(item.target, {force: true}) : await atomicWrite(item.target, item.before);
    throw error;
  }
  return prepared.map(({file, before, after}) => ({path: file.path, before: before === null ? null : sha256(before), after: sha256(after)}));
}
