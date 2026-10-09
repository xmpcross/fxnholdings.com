import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('article and sitemap metadata remain truthful across builds', () => {
  const result = spawnSync('python3', ['tests/build_metadata.py'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, timeout: 20000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
