import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import {sha256} from './patchEngine.js';

const exec = promisify(execFile);
export const ACT_NOW_PATH = 'src/pages/ActNow.jsx';
export const ACT_NOW_HASH = '9E680E6E5FBCB88D7EAB2DB0A1F6B36C7A3427D97D99315F3A9E8CFDBCB2717D';
const git = async (root, args) => (await exec('git', args, {cwd: root, encoding: 'utf8'})).stdout;

export async function validateRepository(root, {allowedChanges = [], requireClean = false} = {}) {
  const repositoryRoot = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
  const branch = (await git(root, ['branch', '--show-current'])).trim();
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  const status = await git(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  const changed = status.trimEnd() ? status.trimEnd().split('\n').map((line) => line.slice(3).replaceAll('\\', '/')) : [];
  const unexpected = changed.filter((file) => !allowedChanges.some((allowed) => file === allowed || file.startsWith(`${allowed}/`)));
  const actNowHash = sha256(await readFile(`${repositoryRoot}/${ACT_NOW_PATH}`));
  if (!branch) throw new Error('Detached HEAD is not allowed.');
  if (requireClean && changed.length) throw new Error(`Worktree must be clean: ${changed.join(', ')}`);
  if (unexpected.length) throw new Error(`Unexpected changed files: ${unexpected.join(', ')}`);
  if (actNowHash !== ACT_NOW_HASH) throw new Error(`${ACT_NOW_PATH} hash mismatch: ${actNowHash}`);
  return {repositoryRoot, branch, head, changed, actNowHash};
}
