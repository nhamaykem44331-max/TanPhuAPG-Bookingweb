import assert from 'node:assert/strict';
import { test } from 'node:test';

import { derivePassengerTitle, defaultTitleForType, isTitleValidForType } from './passengerTitle';

test('BUG REGRESSION: female adult title MRS/MS must survive (was forced to MR)', () => {
  // Client gửi title thật, KHÔNG gửi gender → trước đây ra MR. Giờ phải giữ nguyên.
  assert.equal(derivePassengerTitle('MRS', 'ADT', undefined), 'MRS');
  assert.equal(derivePassengerTitle('MS', 'ADT', undefined), 'MS');
});

test('BUG REGRESSION: female child MISS must survive (was forced to MSTR)', () => {
  assert.equal(derivePassengerTitle('MISS', 'CHD', undefined), 'MISS');
  assert.equal(derivePassengerTitle('MISS', 'INF', undefined), 'MISS');
});

test('keeps every valid explicit title as-is', () => {
  assert.equal(derivePassengerTitle('MR', 'ADT', undefined), 'MR');
  assert.equal(derivePassengerTitle('MSTR', 'CHD', undefined), 'MSTR');
  assert.equal(derivePassengerTitle('MSTR', 'INF', undefined), 'MSTR');
});

test('normalizes case / whitespace of client title', () => {
  assert.equal(derivePassengerTitle('  mrs ', 'ADT', undefined), 'MRS');
  assert.equal(derivePassengerTitle('miss', 'CHD', undefined), 'MISS');
});

test('falls back to gender when title missing', () => {
  assert.equal(derivePassengerTitle(undefined, 'ADT', 'F'), 'MS');
  assert.equal(derivePassengerTitle('', 'ADT', 'M'), 'MR');
  assert.equal(derivePassengerTitle(null, 'CHD', 'F'), 'MISS');
  assert.equal(derivePassengerTitle(undefined, 'INF', 'M'), 'MSTR');
});

test('falls back to polite default when title AND gender missing', () => {
  assert.equal(derivePassengerTitle(undefined, 'ADT', undefined), 'MR');
  assert.equal(derivePassengerTitle(undefined, 'CHD', undefined), 'MSTR');
  assert.equal(derivePassengerTitle(undefined, 'INF', undefined), 'MSTR');
});

test('coerces a title that does not match the passenger kind (never wrong-kind)', () => {
  // Child title for an adult → invalid → fall back to gender/default (không giữ MISS cho người lớn).
  assert.equal(derivePassengerTitle('MISS', 'ADT', 'F'), 'MS');
  assert.equal(derivePassengerTitle('MR', 'CHD', 'M'), 'MSTR');
  assert.equal(derivePassengerTitle('MRS', 'INF', undefined), 'MSTR');
});

test('ignores garbage title values', () => {
  assert.equal(derivePassengerTitle('DR', 'ADT', 'F'), 'MS');
  assert.equal(derivePassengerTitle(123, 'ADT', undefined), 'MR');
});

test('defaultTitleForType + isTitleValidForType', () => {
  assert.equal(defaultTitleForType('ADT'), 'MR');
  assert.equal(defaultTitleForType('CHD'), 'MSTR');
  assert.equal(isTitleValidForType('MRS', 'ADT'), true);
  assert.equal(isTitleValidForType('MRS', 'CHD'), false);
  assert.equal(isTitleValidForType('MISS', 'INF'), true);
  assert.equal(isTitleValidForType('MR', 'INF'), false);
});
