import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordResetToken, hashPasswordResetToken } from '../src/lib/password-reset.js';

test('password reset tokens are random and only stored as SHA-256 hashes', () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.notEqual(first, second);
  assert.equal(first.length, 43);
  assert.notEqual(hashPasswordResetToken(first), first);
  assert.match(hashPasswordResetToken(first), /^[a-f0-9]{64}$/);
});
