import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('login portal release control', () => {
  it('defaults closed and keeps reopening explicit', async () => {
    const source = await readFile(
      new URL('../src/App.jsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain(
      "import.meta.env.VITE_LOGIN_PORTAL_ENABLED === 'true'"
    );
    expect(source).toContain('if (!loginPortalEnabled)');
    expect(source).toContain('return <BuildInProgress />');
    expect(source.indexOf('if (!loginPortalEnabled)')).toBeLessThan(
      source.indexOf('<AuthProvider>')
    );
  });

  it('does not place login or password controls on the closed screen', async () => {
    const source = await readFile(
      new URL('../src/App.jsx', import.meta.url),
      'utf8'
    );
    const start = source.indexOf('function BuildInProgress()');
    const end = source.indexOf('\nfunction App()', start);
    const closedScreen = source.slice(start, end);

    expect(closedScreen).not.toContain('FirebaseLogin');
    expect(closedScreen).not.toContain('password');
    expect(closedScreen).not.toContain('Sign in');
  });
});
