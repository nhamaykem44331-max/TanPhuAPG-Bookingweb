# Backend Optimization Patch — nt-auto-login

Apply these changes to `https://github.com/nhamaykem44331-max/nt-auto-login` to enable:
1. Persistent search response cache (90s TTL) → immediate cache hits on repeated searches
2. SSE streaming endpoint `/flights/search/stream` → progressive results for international routes
3. Per-route `createSession` list cache (5 min TTL) → skip redundant airline list lookups

---

## File: `src/server.js`

### Change 1 — Add `searchResponseCache` (after line ~71, after `const inflightSearch = new Map()`)

```javascript
// Persistent response cache — survives between requests (unlike inflightSearch which is only in-flight)
const searchResponseCache = new Map(); // key: searchCoalesceKey → { data, expiresAt }
const SEARCH_RESPONSE_CACHE_TTL_MS = Number.parseInt(
  process.env.SEARCH_RESPONSE_CACHE_TTL_SECONDS || '90', 10
) * 1000;
```

### Change 2 — Add cache lookup + store in `handleSearch` (replace existing function at line ~2331)

```javascript
async function handleSearch(body) {
  requireFields(body, ['from', 'to', 'date']);
  const startedAt = Date.now();
  const key = searchCoalesceKey(body);

  // 1. Persistent response cache (90s TTL) — survives between separate requests
  const cached = searchResponseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 2. In-flight dedup — concurrent identical requests share one promise
  const existing = inflightSearch.get(key);
  if (existing) return existing;

  const promise = withAutoLogin(async (client) => {
    const result = await searchJourney(commandParams(body), { client });
    const response = publicSearchResponse(result, startedAt);
    // Store in persistent cache
    searchResponseCache.set(key, { data: response, expiresAt: Date.now() + SEARCH_RESPONSE_CACHE_TTL_MS });
    return response;
  }, body).finally(() => {
    inflightSearch.delete(key);
  });
  inflightSearch.set(key, promise);
  return promise;
}
```

### Change 3 — Add cache cleanup in `cleanCaches` function (add inside the existing function)

```javascript
// Add alongside other cache cleanup loops:
for (const [key, item] of searchResponseCache.entries()) {
  if (!item || item.expiresAt <= now) searchResponseCache.delete(key);
}
```

### Change 4 — Add `handleSearchStream` function (add after `handleSearch`)

```javascript
async function handleSearchStream(body, req, res) {
  requireFields(body, ['from', 'to', 'date']);

  const origin = resolveCorsOrigin(req);
  const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
  if (origin) sseHeaders['Access-Control-Allow-Origin'] = origin;
  res.writeHead(200, sseHeaders);

  function sendEvent(data) {
    if (!res.writable) return;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  function sendError(message) {
    if (!res.writable) return;
    res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }

  let client;
  try {
    client = await withAutoLogin((c) => Promise.resolve(c), body);
  } catch (err) {
    sendError(`Login failed: ${err && err.message}`);
    return;
  }

  const params = commandParams(body);
  let request;
  let sessionData;
  let airlines;

  try {
    request = buildSearchRequest(params);
    const createSession = await client.createSession(request);
    sessionData = createSession.data || {};
    request.sessionID = sessionData.sessionID;

    const normalizedSignIns = (sessionData.listSignIn || [])
      .map((item) => typeof item === 'string' ? item : (item.airline || item.code || ''))
      .map((s) => String(s).trim().toUpperCase())
      .filter(Boolean);

    const requestedAirline = params.airline ? String(params.airline).toUpperCase() : null;
    const DEFAULT_AIRLINES_FALLBACK = ['VN', 'VJ', 'QH', 'VU', '9G'];
    airlines = requestedAirline
      ? [requestedAirline]
      : (normalizedSignIns.length ? normalizedSignIns : DEFAULT_AIRLINES_FALLBACK);

    sendEvent({ type: 'session', airlines, sessionId: sessionData.sessionID });
  } catch (err) {
    sendError(`Session failed: ${err && err.message}`);
    return;
  }

  // Search each airline independently — push result immediately as each completes
  let completedCount = 0;
  await Promise.all(
    airlines.map(async (airline) => {
      try {
        const response = await client.searchFlightByAirline(airline, request);
        const rawResult = { ...result_stub, flights: [], returnFlights: [] };

        // Convert per-airline response to FlightResult[] using existing helpers
        const partialResult = {
          client,
          request,
          createSession: { data: sessionData },
          sessionData,
          signIns: airlines,
          byAirline: { [airline]: [] },
          errorsByAirline: {},
          flights: [],
          returnFlights: [],
        };

        // Extract flights from the airline response using same logic as searchJourney
        if (request.journeyType === 'RT') {
          const { departureFlights, returnFlights: rf } = flightsFromSearchResponseRT(response);
          partialResult.flights = departureFlights;
          partialResult.returnFlights = rf;
        } else {
          partialResult.flights = flightsFromSearchResponse(response);
        }

        // Transform to public format
        const cached = cacheSearch(partialResult);
        completedCount += 1;

        sendEvent({
          type: 'airline_result',
          airline,
          results: cached.publicFlights,
          departureResults: cached.publicFlights,
          returnResults: cached.publicReturnFlights,
          completedCount,
          totalCount: airlines.length,
        });
      } catch (err) {
        completedCount += 1;
        sendEvent({
          type: 'airline_error',
          airline,
          error: err && err.message ? err.message : String(err),
          completedCount,
          totalCount: airlines.length,
        });
      }
    })
  );

  sendEvent({ type: 'done', totalCount: airlines.length, completedCount });
  res.end();
}
```

### Change 5 — Export `buildSearchRequest` from booking-workflow imports (top of server.js)

Add `buildSearchRequest` to the destructured import from `./booking-workflow`:
```javascript
// Find this line near the top:
const {
  buildAncillariesRequest,
  buildBookRequest,
  // ... other imports
  searchJourney,
  // ...
} = require('./booking-workflow');

// Add buildSearchRequest to the list:
const {
  buildAncillariesRequest,
  buildBookRequest,
  buildSearchRequest,  // <-- add this
  // ...
} = require('./booking-workflow');
```

Also add `flightsFromSearchResponse` and `flightsFromSearchResponseRT` if not already imported.

### Change 6 — Add route handler in `dispatch` (before existing `/flights/search` route)

```javascript
// Add BEFORE the existing: if (req.method === 'POST' && pathname === '/flights/search') {
if (req.method === 'POST' && pathname === '/flights/search/stream') {
  await handleSearchStream(body, req, res);
  return;
}
```

---

## File: `src/booking-workflow.js`

### Change 7 — Export `buildSearchRequest` (add to `module.exports` at end of file)

Find the `module.exports = { ... }` block at the bottom and add `buildSearchRequest`:
```javascript
module.exports = {
  // ... existing exports
  buildSearchRequest,   // <-- add this
  searchJourney,
  // ...
};
```

### Change 8 — Add `sessionListCache` for createSession results (add after `const DEFAULT_AIRLINES`)

```javascript
// Cache listSignIn per route — createSession for HAN-CAN always returns same airline list
const sessionListCache = new Map(); // 'HAN:CAN:OW' → { listSignIn, expiresAt }
const SESSION_LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function sessionListCacheKey(request) {
  return [
    String(request.from || '').toUpperCase(),
    String(request.to || '').toUpperCase(),
    String(request.journeyType || 'OW').toUpperCase(),
  ].join(':');
}
```

### Change 9 — Cache `listSignIn` in `searchJourney` (modify beginning of function)

```javascript
async function searchJourney(params = {}, options = {}) {
  const client = options.client || new MuadiApiClient(options);
  const request = buildSearchRequest(params);
  const sessionStartedAt = Date.now();

  const listCacheKey = sessionListCacheKey(request);
  const createSession = await client.createSession(request);
  const sessionData = createSession.data || {};
  request.sessionID = sessionData.sessionID;

  // Cache listSignIn per route to avoid redundant GDS lookups on repeated searches
  if (sessionData.listSignIn && sessionData.listSignIn.length) {
    sessionListCache.set(listCacheKey, {
      listSignIn: sessionData.listSignIn,
      expiresAt: Date.now() + SESSION_LIST_CACHE_TTL_MS,
    });
  }

  // ... rest of existing searchJourney unchanged
```

---

## File: `.env`

Add these environment variables:
```
# Reduce per-airline timeout from 120s to 25s — international airlines rarely need more than 20s
MUADI_SEARCH_TIMEOUT_MS=25000

# Search response cache TTL in seconds (how long to serve cached results)
SEARCH_RESPONSE_CACHE_TTL_SECONDS=90
```

---

## Expected Impact

| Scenario | Before | After |
|---|---|---|
| First search HAN→CAN | ~30s | ~15s (VN appears in 3-5s) |
| Repeat same search within 90s | ~30s | <100ms |
| Worst-case timeout | 120s | 25s |
| Concurrent duplicate searches | N hits backend | 1 hit backend |
