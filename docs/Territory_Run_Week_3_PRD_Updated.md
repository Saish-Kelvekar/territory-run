# Territory Run --- Week 3 PRD: Server-Side Loop Validation and Polygon Rendering

**Status:** Updated after Week 2 GPS tracking and MapLibre integration\
**Execution window:** Set the actual start and end dates before
beginning Week 3. The original October 19--25 window has passed.\
**Estimated effort:** Approximately 15--17 focused hours\
**Working branch:** `week-3-spike`\
**Primary outcome:** GPS points → authenticated API → PostGIS validation
and area calculation → polygon rendered using the existing MapLibre map

------------------------------------------------------------------------

## 0. Week 2 baseline and implementation constraints

Week 2 is complete and merged. The mobile app already has:

-   Expo SDK \~57, React Native 0.86, TypeScript, and Expo Router.
-   MapLibre React Native with the OpenFreeMap Liberty style.
-   Foreground GPS tracking, accepted-point filtering, distance and
    duration tracking, pause/resume, and basic loop-closure detection.
-   An existing API client at `mobile/src/lib/api.ts`, including the
    established authentication/request behavior.
-   Existing field notes at `docs/field-notes.md`.
-   A passing baseline of Jest tests, TypeScript checking, and linting.

**Build on this implementation; do not replace it.**

### Required integration decisions

1.  **Keep MapLibre.** Do not introduce `react-native-maps`,
    `PROVIDER_GOOGLE`, a Google Maps API key, or a second mapping stack.
    Render the path and returned polygon through the existing MapLibre
    setup and preserve its current style, attribution, and camera
    conventions.
2.  **Use the existing Expo Router structure.** The temporary screen
    belongs at `mobile/src/app/spike.tsx` if that matches the current
    route layout. Inspect the actual `mobile/src/app` structure first
    and follow its conventions. Do not create a second `mobile/app`
    router directory.
3.  **Reuse the existing API client.** Implement the spike endpoint call
    in `mobile/src/services/spike.ts`, using `mobile/src/lib/api.ts` and
    its existing JWT/error behavior. Do not duplicate token retrieval,
    authentication headers, base-URL handling, or create a second
    generic API client.
4.  **Keep Week 2's loop detection in perspective.** The mobile
    proximity check is an immediate tracking/UI signal. Week 3 adds
    authoritative server-side validation, PostGIS geometry processing,
    and area calculation. It does not yet claim territory or save runs.
5.  **Keep this a spike.** The endpoint analyzes submitted points and
    returns a result without persisting a run or changing territory
    ownership.
6.  **Do not silently change existing dependencies or project
    conventions.** Inspect the repository and its scripts before
    choosing the test runner, adding a type package, or changing
    configuration.

### Existing field-test baseline

Review `docs/field-notes.md` before testing. The Week 2 test recorded
approximately 8 m GPS accuracy, 16 raw/accepted points, 49 m distance, 2
min 24 sec duration, and a closed loop. Pause/resume also produced a
visible gap between route segments.

This is useful baseline evidence, but it does **not** replace Week 3's
planned longer outdoor test. Record new observations separately and do
not automatically implement gap reconnection or route snapping unless
the results justify it and the behavior is explicitly documented.

------------------------------------------------------------------------

## 1. Objective

Prove the riskiest geometry workflow end to end: a list of GPS points is
validated by the backend, processed with PostGIS into valid polygon
geometry, assigned a real area in square metres, returned as GeoJSON,
and rendered on the existing mobile map.

At the end of the week, the app must be able to analyze generated and
real location samples and explain why a candidate loop was accepted or
rejected.

## 2. Scope

### In scope

-   A JWT-protected `POST /spike/loop` endpoint.
-   Zod validation for incoming coordinates and timestamps.
-   Centralized loop rules in `server/src/config/rules.ts`.
-   Raw PostGIS SQL, first written and tested independently in DBeaver.
-   Filtering inaccurate points and repeated coordinates.
-   Closure gap, distance, polygon validity, and area calculations.
-   A response contract that returns reasons and GeoJSON polygon
    geometry.
-   A temporary simulation screen with loop, straight-line,
    figure-eight, and tiny-loop cases.
-   Rendering the route and returned polygon with the existing MapLibre
    map implementation.
-   Unit/integration tests and an emulator route replay plus a real
    outdoor test.
-   Documentation of thresholds, findings, and how to try the spike.

### Explicitly out of scope

-   Saving runs to the database (planned for Week 4).
-   Territory ownership, territory capture, or other players' land
    (planned for a later week).
-   Background tracking or tracking with the screen off (planned for
    Week 4).
-   Anti-cheat speed checks (planned for Week 5).
-   Leaderboards.
-   Production-grade route fraud detection.
-   Replacing MapLibre or adding a Google Maps configuration.

------------------------------------------------------------------------

## 3. Success criteria

1.  A generated circular route with approximately 100 m radius returns
    `isLoop: true` and an area near 31,000 m², within the test's defined
    tolerance, and its polygon is rendered at the correct location.
2.  A straight-line route returns `isLoop: false` with `NOT_CLOSED`.
3.  A figure-eight input produces valid polygon geometry with two
    positive-area polygon components (normally represented as a GeoJSON
    `MultiPolygon`); tests verify the actual output rather than assuming
    every self-intersection will be split exactly as intended.
4.  A small closed loop below the configured minimum area returns
    `AREA_TOO_SMALL`. It may also return `DISTANCE_TOO_SHORT` if it
    fails that independent rule.
5.  Inputs containing points with accuracy worse than the configured
    maximum have those points excluded; `pointsUsed` reflects the number
    of points actually used after filtering and deduplication, as
    documented by the implementation.
6.  The flow works with generated routes, an Android emulator route
    replay, and one longer real outdoor walk.
7.  Tests cover closure boundaries, distance and area thresholds,
    inaccurate points, malformed coordinates, too few usable points,
    repeated points, and GeoJSON coordinate order.
8.  Existing mobile map behavior remains intact, and the Week 2 test
    baseline (tests, TypeScript, lint) remains clean.

------------------------------------------------------------------------

## 4. API contract

### Request

`POST /spike/loop`

Requires the existing JWT authentication middleware:

`Authorization: Bearer <token>`

Example body:

``` json
{
  "points": [
    { "lat": 15.0001, "lng": 75.0002, "t": 1760000000000, "accuracy": 8 },
    { "lat": 15.0002, "lng": 75.0003, "t": 1760000001000, "accuracy": 7 }
  ]
}
```

The example is abbreviated; a usable request must contain enough points
to form a route.

### Successful analysis response

Return HTTP `200` for a successfully analyzed request, including a route
that is not a valid loop:

``` json
{
  "isLoop": true,
  "reasons": [],
  "distanceM": 642.3,
  "gapM": 12.4,
  "areaM2": 31204.7,
  "pointsUsed": 118,
  "polygon": {
    "type": "MultiPolygon",
    "coordinates": []
  }
}
```

The coordinates above are illustrative. Return the actual geometry
produced by PostGIS. For a rejected or unusable route, `polygon` may be
`null` when no valid polygon can be produced; document and type this
explicitly rather than returning fake geometry.

### Reasons

The response may contain one or more of:

-   `NOT_CLOSED`
-   `AREA_TOO_SMALL`
-   `DISTANCE_TOO_SHORT`
-   `TOO_FEW_POINTS`

Multiple reasons are valid. For example, a tiny loop may be both too
small in area and too short in total distance. Define consistent
behavior for cases where no polygon can be constructed.

### Errors

Keep the server's established error shape:

``` json
{ "message": "Readable explanation", "code": "ERROR_CODE", "fields": {} }
```

Use the existing error-handling conventions where possible. Invalid
request bodies should be rejected by Zod before SQL is run.

### Coordinate conventions

-   API points use named `lat` and `lng` fields.
-   GeoJSON coordinates must be `[longitude, latitude]` (`[lng, lat]`).
-   MapLibre coordinate features must follow the format expected by the
    existing MapLibre implementation.
-   Add tests for coordinate order and location so a polygon is not
    accidentally rendered in the wrong place.

### Centralized rules

Create or update `server/src/config/rules.ts`:

``` ts
export const RULES = {
  maxAccuracyM: 30,
  closureGapM: 40,
  minAreaM2: 2000,
  minDistanceM: 300,
  minPoints: 4,
} as const;
```

Treat these as initial experiment thresholds, not proven production
values. Thresholds should be defined in one place, with rationale and
field-test evidence documented in `docs/rules.md`.

**Important:** `minPoints` is a geometric guard, not a guarantee that
four arbitrary points form a useful loop. Validate that there are enough
usable, distinct points to construct a valid ring before calling polygon
functions.

------------------------------------------------------------------------

## 5. Expected files and repository conventions

Inspect the repository before creating files. Adjust names only when
required by existing architecture; avoid duplicate implementations.

``` text
server/src/
  config/rules.ts
  routes/spike.routes.ts
  controllers/spike.controller.ts
  services/spike.service.ts
  services/spike.service.test.ts     # or the established test location/convention
server/src/app.ts                    # mount /spike and configure JSON limit if needed

mobile/src/
  app/spike.tsx                      # temporary route; verify current Expo Router layout
  types/geo.ts                       # LatLngPoint, LoopResult
  services/spike.ts                  # uses existing lib/api.ts
  utils/geo.ts                       # GeoJSON-to-MapLibre conversion helpers
  utils/simulate.ts                  # deterministic route generators where possible
  hooks/useSimulatedRun.ts            # replays generated points
  components/RunMap.tsx              # extend/reuse the existing MapLibre map

docs/
  rules.md
  field-notes.md                     # append Week 3 findings; preserve Week 2 notes
sql-practice/
  week3-loop.sql
```

Do not create a second map component or API client if the repository
already has an appropriate component or abstraction. Prefer extending
the existing MapLibre map with optional route/polygon inputs where that
is the cleanest fit.

------------------------------------------------------------------------

## 6. Day-by-day implementation plan

The original October 19--25 schedule is outdated. Assign actual calendar
dates before starting. Keep the following order so that each stage is
verified before moving to the next.

### Day 1 --- Contract, rules, and types (about 2 hours)

1.  Confirm the Week 2 merge is present in the branch base and inspect
    the repository status.
2.  Create the working branch `week-3-spike` from the current
    integration branch containing Week 2.
3.  Inspect the existing server structure, validation patterns, auth
    middleware, test scripts, mobile route layout, API client, and
    MapLibre map component.
4.  Add `RULES` and `docs/rules.md`, explaining each initial threshold
    and how it will be tested.
5.  Define `LatLngPoint`, reason-code types, and `LoopResult`. If no
    polygon can be constructed for an invalid route, type `polygon` as
    nullable.
6.  Use the project's existing GeoJSON types if present; add a type
    dependency only if genuinely required.

Suggested types:

``` ts
export type LatLngPoint = {
  lat: number;
  lng: number;
  t: number;
  accuracy?: number;
};

export type LoopReason =
  | "NOT_CLOSED"
  | "AREA_TOO_SMALL"
  | "DISTANCE_TOO_SHORT"
  | "TOO_FEW_POINTS";

export type LoopResult = {
  isLoop: boolean;
  reasons: LoopReason[];
  distanceM: number;
  gapM: number;
  areaM2: number;
  pointsUsed: number;
  polygon: GeoJSON.MultiPolygon | null;
};
```

Verify the types compile and existing checks still pass. Commit after
review, for example: `feat: define week 3 loop analysis contract`.

### Day 2 --- Learn and test the SQL in DBeaver first (about 2.5 hours)

Do not start by hiding the geometry logic inside Node code. First test a
hardcoded GeoJSON LineString in DBeaver and understand each PostGIS
function. Save the working query in `sql-practice/week3-loop.sql`.

The SQL should:

-   Convert the input GeoJSON LineString to SRID 4326.
-   Remove repeated points.
-   Calculate route length and start-to-end gap using `geography` so the
    results are in metres.
-   Close the candidate ring only for polygon construction; preserve the
    original route's measured gap.
-   Avoid calling `ST_MakePolygon` on too-short or degenerate lines.
-   Use `ST_MakeValid` and polygon-only extraction where appropriate.
-   Return polygon GeoJSON and area in square metres.
-   Handle empty, invalid, or non-polygon results without crashing the
    endpoint.

Functions to understand include `ST_GeomFromGeoJSON`, `ST_SetSRID`,
`ST_RemoveRepeatedPoints`, `ST_StartPoint`, `ST_EndPoint`,
`ST_AddPoint`, `ST_MakePolygon`, `ST_MakeValid`, `ST_CollectionExtract`,
`ST_Multi`, `ST_Length`, `ST_Distance`, `ST_Area`, and the `::geography`
cast.

Test at least: - A small valid square. - A closed circular-like route
with a known approximate area. - A straight line. - Repeated adjacent
points. - A self-crossing bowtie/figure-eight-like route, checking what
geometry PostGIS actually returns.

Do not assume a self-crossing input will necessarily become exactly two
polygons. Inspect and assert the actual valid geometry behavior. If you
use a small coordinate fixture, scale it to a meaningful local size and
avoid interpreting raw degree units as metres.

### Day 3 --- Implement the protected endpoint (about 2.5 hours)

1.  Implement `spike.service.ts` with parameterized SQL. Pass
    `JSON.stringify(lineString)` as a query parameter; do not
    interpolate user input into SQL.
2.  Filter points whose `accuracy` is greater than `RULES.maxAccuracyM`.
    Keep points with missing accuracy according to a documented policy;
    do not silently treat missing accuracy as zero-quality GPS.
3.  Remove or handle consecutive duplicate coordinates before geometry
    creation.
4.  Validate coordinates and timestamps with Zod. Require a bounded
    array size (minimum and maximum), finite numeric values, latitude in
    `[-90, 90]`, longitude in `[-180, 180]`, and a reasonable timestamp
    representation.
5.  After filtering/deduplication, check the number of usable distinct
    points before executing geometry functions. Return `TOO_FEW_POINTS`
    without querying unsafe polygon construction when there are too few
    points.
6.  Mount `POST /spike/loop` behind the existing auth middleware.
7.  Check the existing Express parser configuration. Set or adjust
    `express.json({ limit: "1mb" })` only if it is not already
    configured appropriately. Keep the limit aligned with the endpoint's
    maximum point count; do not assume 20,000 points always fit in 1 MB.
8.  Apply the centralized rules consistently. `isLoop` is true only when
    all required checks pass and the resulting geometry is valid and has
    positive area.
9.  Define `pointsUsed` clearly as the count of usable points passed
    into the geometry calculation after accuracy filtering and duplicate
    handling.
10. Test through the existing API workflow (Bruno or equivalent): valid
    loop, straight line, tiny loop, inaccurate points, too few points,
    invalid coordinates, unauthenticated request, and malformed JSON.

Potential decision logic: - `gapM > closureGapM` → `NOT_CLOSED` -
`areaM2 < minAreaM2` → `AREA_TOO_SMALL` - `distanceM < minDistanceM` →
`DISTANCE_TOO_SHORT` - Too few usable distinct points → `TOO_FEW_POINTS`

Do not report `AREA_TOO_SMALL` as the only reason when no valid
polygon/area exists. Document how `gapM`, `areaM2`, and `polygon` are
represented when a route cannot produce valid polygon geometry.

### Day 4 --- Render the result using MapLibre (about 2.5 hours)

1.  Add `mobile/src/utils/geo.ts` conversion helpers for GeoJSON
    coordinates to the coordinate structure expected by the existing
    MapLibre component.
2.  Extend or reuse the existing map component to draw the GPS path and,
    when available, the polygon returned by the server. Use the MapLibre
    source/layer or shape conventions already present in the app; do not
    use `react-native-maps` `Polyline`, `Polygon`, `PROVIDER_GOOGLE`, or
    `fitToCoordinates`.
3.  Preserve the existing map style, attribution, camera behavior, and
    location display.
4.  Implement `mobile/src/services/spike.ts` using
    `mobile/src/lib/api.ts`. Reuse its base URL, auth, and error
    handling.
5.  Add the temporary spike screen under the existing Expo Router
    directory (expected `mobile/src/app/spike.tsx`, subject to
    repository verification). Include a way to submit a known test route
    and display the result.
6.  Verify that the path and polygon render in the correct geographic
    location and that holes or multiple polygon components are handled
    correctly if returned.

Commit after verifying the existing map still works.

### Day 5 --- Simulation mode (about 2.5 hours)

Build generators for: - A closed circular loop with configurable radius
and small GPS noise. - An open straight line. - A
figure-eight/self-crossing route. - A tiny closed loop designed to test
the minimum-area rule.

Use deterministic seeds or fixed fixtures for automated tests where
practical. Keep random noise configurable so tests do not become flaky.

Build `useSimulatedRun(points, speedMs)` to replay one point at a time
and expose a clear interface such as
`{ points, start, stop, isRunning }`. Clean up timers on stop and
component unmount.

Add controls to the temporary spike screen for each route type and an
**Analyse** action. Show `isLoop`, `reasons`, `areaM2`, `distanceM`,
`gapM`, `pointsUsed`, and the rendered polygon where available.

### Day 6 --- Emulator and real-world validation (about 2 hours)

1.  **Android emulator:** Use Android Studio's Extended Controls →
    Location → Routes (or the available GPX route playback workflow) to
    replay a route. Confirm the app receives points while foregrounded
    and analyze the collected route.
2.  **Real phone:** Walk a longer loop of approximately 300 m or more in
    a safe outdoor area. Close it near the start and record observed
    accuracy, distance, start/end gap, and whether a valid polygon was
    produced.
3.  Review the Week 2 baseline in `docs/field-notes.md` and keep Week 3
    observations clearly separated.
4.  Update `docs/rules.md` with observations and a reasoned
    recommendation for each threshold. Do not raise thresholds just to
    make one test pass; record the evidence and the trade-off.
5.  Note the pause/resume segment gap as an observation. Do not
    implement route snapping or automatic gap bridging as part of this
    spike unless separately approved.

### Day 7 --- Tests, cleanup, and PR review (about 2 hours)

Use the test runner already configured in the repository (Jest was used
in the Week 2 mobile baseline; inspect server scripts before assuming
the server runner). Tests should cover:

-   Valid square/circular loop: valid geometry and area within a
    justified tolerance.
-   Straight line: `NOT_CLOSED`.
-   Gap immediately below and above the 40 m boundary.
-   Route shorter than 300 m: `DISTANCE_TOO_SHORT`.
-   Area below 2,000 m²: `AREA_TOO_SMALL`; allow additional applicable
    reasons.
-   Three points or too few usable distinct points: `TOO_FEW_POINTS`,
    with no database geometry error.
-   Points with accuracy worse than 30 m are excluded and `pointsUsed`
    is correct.
-   Invalid latitude/longitude and malformed payload are rejected.
-   Repeated adjacent points do not create invalid geometry.
-   GeoJSON coordinates use `[lng, lat]` and render at the expected
    location.
-   Polygon geometry is valid and has positive area; figure-eight
    expectations match the observed PostGIS output.
-   Unauthenticated requests are rejected.

Then: 1. Run the server tests. 2. Run mobile tests. 3. Run
`npx tsc --noEmit` and `npm run lint` in the relevant workspace(s). 4.
Manually verify generated routes, emulator replay, and the real walk. 5.
Update the root README with how to run the spike and its limitations. 6.
Review the full diff for accidental Week 2 regressions, secrets,
duplicate map/API implementations, and unrelated files. 7. Open a PR,
merge only after checks pass, and tag the merged commit if the
repository's release workflow still uses this tag: `week-3-done`.

Do not push a tag or merge until the PR has been reviewed and all
required checks pass.

------------------------------------------------------------------------

## 7. Definition of done

-   [ ] The API contract and rules are documented.
-   [ ] SQL was first tested and understood in DBeaver and saved to
    `sql-practice/week3-loop.sql`.
-   [ ] `POST /spike/loop` is protected by the existing JWT middleware
    and validates its input.
-   [ ] PostGIS returns valid geometry and area in square metres for
    valid loops.
-   [ ] Invalid routes return consistent reasons and do not crash
    geometry processing.
-   [ ] Thresholds are centralized in `server/src/config/rules.ts`;
    rationale and field evidence are in `docs/rules.md`.
-   [ ] The mobile spike screen uses the existing API client and
    MapLibre map.
-   [ ] Simulation covers loop, line, figure-eight, and tiny loop.
-   [ ] An emulator route replay and a longer real outdoor walk are
    documented.
-   [ ] Tests, TypeScript checking, and lint pass.
-   [ ] Existing Week 2 functionality remains intact; no secrets are
    committed.
-   [ ] The PR is reviewed before merge.

------------------------------------------------------------------------

## 8. Common problems and debugging notes

-   **Polygon appears in the wrong place:** Check GeoJSON `[lng, lat]`
    order and the coordinate format expected by the existing MapLibre
    source/layer.
-   **`ST_MakePolygon` fails:** Check for too few usable distinct
    points, repeated coordinates, a degenerate ring, or an unclosed
    line. Guard before polygon construction.
-   **Area is wildly wrong:** Confirm the area is calculated using
    `geometry::geography` (or an appropriate projected coordinate
    system), not raw square degrees.
-   **Request returns 413:** Review the configured body limit and
    maximum point count together. Do not simply raise the limit without
    a reason.
-   **No polygon is returned:** Inspect the validity/empty-geometry path
    and return documented `reasons` and nullable `polygon` rather than
    crashing.
-   **Emulator route does not move:** Ensure route playback is running,
    emulator location is enabled, and the app has foreground location
    permission.
-   **Real GPS gap exceeds 40 m:** Record actual measurements first.
    Recommend a threshold change only with evidence and document the
    false-acceptance/false-rejection trade-off.
-   **Map styling changes unexpectedly:** Reuse the existing MapLibre
    style, attribution, and camera behavior rather than creating a
    second map implementation.
-   **Authentication fails in the spike screen:** Use
    `mobile/src/lib/api.ts`; do not create a parallel token or base-URL
    implementation.

------------------------------------------------------------------------

## 9. What Week 4 builds on this

Week 4 is expected to persist completed runs (for example, a `runs`
table and `POST /runs`) by reusing the Week 3 analysis service. It will
also build the run screen's start/pause/finish flow and foreground
tracking behavior. Confirm the final Week 4 plan before implementing it.

The `/spike/loop` endpoint is temporary. Week 4 may replace or wrap it
with the production run endpoint, but keep the simulation fixtures/tools
where they remain useful for regression testing. Week 3 does not save
runs, claim land, or update territory ownership.

------------------------------------------------------------------------

## 10. Agent handoff prompt

Use this prompt after confirming the updated PRD and repository
structure. The agent should work one stage at a time and wait for
verification before continuing.

``` text
We are implementing Week 3 of Territory Run: server-side loop validation and polygon rendering.

Week 1 and Week 2 are complete and merged. Week 2 uses Expo SDK ~57, React Native 0.86, TypeScript, Expo Router, MapLibre React Native, and OpenFreeMap Liberty. It already includes foreground GPS tracking, accepted-point filtering, distance/duration, pause/resume, basic proximity-based loop closure, and an API client at mobile/src/lib/api.ts. Read the root README, this Week 3 PRD, docs/field-notes.md, and the existing code before changing anything.

GOAL
Implement a JWT-protected POST /spike/loop endpoint that validates GPS points, uses parameterized PostGIS SQL to calculate route length, start/end gap, valid polygon geometry and area in square metres, and returns reasons plus GeoJSON. The mobile spike screen must display the result on the existing MapLibre map.

NON-NEGOTIABLE INTEGRATION RULES
- Keep MapLibre and the existing OpenFreeMap style. Do not add react-native-maps, Google Maps provider/key, or a second map stack.
- Verify the Expo Router directory and use the existing route layout; expected screen path is mobile/src/app/spike.tsx. Do not create a second app/ directory.
- Use mobile/src/lib/api.ts for requests and auth. Do not duplicate token, headers, base URL, or generic API-client logic.
- Inspect the server's existing auth, Zod, error handling, database, and test conventions before implementing.
- Use parameterized raw SQL, not an ORM and not interpolated user input.
- Rules live in server/src/config/rules.ts and are documented in docs/rules.md.
- Write and test the SQL in DBeaver first; save it to sql-practice/week3-loop.sql.
- Week 3 analyzes routes only. Do not persist runs, claim territory, implement background tracking, anti-cheat, or leaderboards.
- Preserve Week 2 behavior and field notes.

RULES TO START WITH
maxAccuracyM: 30
closureGapM: 40
minAreaM2: 2000
minDistanceM: 300
minPoints: 4

IMPLEMENTATION ORDER
1. Inspect repository status, branch base, README, field notes, existing map/API/auth/test structure. Report findings and wait.
2. Add contract/types/rules and documentation; run relevant checks and wait.
3. Develop and verify the PostGIS SQL in DBeaver; explain each important function and wait for my test result.
4. Implement the protected endpoint, Zod validation, filtering, geometry safety checks, and tests.
5. Extend the existing MapLibre rendering and use the existing API client.
6. Add deterministic/configurable route simulations and the temporary spike screen.
7. Test emulator route replay and one longer outdoor walk; document measured results.
8. Run all relevant tests, TypeScript checks, lint, inspect the full diff, then prepare a PR. Do not merge or tag without review.

GEOJSON USES [longitude, latitude]. Define behavior for invalid/empty geometry and nullable polygon explicitly. Multiple reasons may apply to one route. pointsUsed must reflect the documented filtering/deduplication policy. Do not assume self-crossing input always yields exactly two polygons; verify PostGIS output.

I am learning, so give exact commands, files, expected output, and verification steps. Work one stage at a time and wait for my result before proceeding.
```
