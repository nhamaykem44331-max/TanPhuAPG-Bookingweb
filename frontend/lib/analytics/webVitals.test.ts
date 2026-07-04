import assert from 'node:assert/strict';
import test from 'node:test';

import { clearWebVitalsForTests, getWebVitalsSnapshot, recordWebVital } from '@/lib/analytics/webVitals';

test('web vitals store records metrics and summarizes p75 by metric and path', () => {
  clearWebVitalsForTests();

  recordWebVital({ id: 'a', name: 'LCP', value: 1200, rating: 'good', path: '/', timestamp: 1 });
  recordWebVital({ id: 'b', name: 'LCP', value: 3200, rating: 'poor', path: '/', timestamp: 2 });
  recordWebVital({ id: 'c', name: 'INP', value: 140, rating: 'good', path: '/quote', timestamp: 3 });

  const snapshot = getWebVitalsSnapshot();
  const lcp = snapshot.byMetric.find((item) => item.name === 'LCP');
  const home = snapshot.byPath.find((item) => item.path === '/');

  assert.equal(snapshot.total, 3);
  assert.equal(lcp?.count, 2);
  assert.equal(lcp?.p75, 3200);
  assert.equal(lcp?.poor, 1);
  assert.equal(home?.lcpP75, 3200);
  assert.equal(snapshot.recent[0]?.id, 'c');
});
