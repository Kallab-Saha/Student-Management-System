import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isValidFirestoreId, sanitizeEmail } from './portalValidation';

const RULES_PATH = path.resolve(import.meta.dirname, '../../firestore.rules');
const BLUEPRINT_PATH = path.resolve(import.meta.dirname, '../../firebase-blueprint.json');

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8')) as {
    firestore: Record<string, unknown>;
  };

  const collections = Object.keys(blueprint.firestore).map((p) =>
    p.split('/').filter(Boolean)[0]
  );

  for (const col of collections) {
    assert.ok(
      rules.includes(`match /${col}/`),
      `firestore.rules must define a match block for /${col}/`
    );
  }
});

test('firestore.rules enforces Eight Pillars security guards and Dirty Dozen invariants', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf8');

  // 1. Default deny catch-all at top
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  // 2. Verified user email guard
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  // 3. No blanket list reads
  assert.equal(/allow\s+(read|list)\s*:\s*if\s+(true|isSignedIn\(\)|isVerifiedUser\(\))\s*;/.test(rules), false);
  // 4. ID poisoning guard regex
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"));
  assert.equal(isValidFirestoreId('sub-cs501'), true);
  assert.equal(isValidFirestoreId('../bad/path'), false);
  assert.equal(isValidFirestoreId('x'.repeat(200)), false);
  assert.equal(sanitizeEmail('  Admin@Example.COM '), 'admin@example.com');
});
