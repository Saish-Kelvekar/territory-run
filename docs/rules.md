# Loop Validation Rules

Week 3 introduces server-side loop analysis for the `POST /spike/loop` spike endpoint.
These thresholds are the initial experiment values, not proven production settings. They
live in `server/src/config/rules.ts` so the endpoint, SQL workflow, and tests use one
source of truth.

| Rule | Value | Unit | Purpose |
| --- | --- | --- | --- |
| `maxAccuracyM` | 30 | metres | Exclude GPS points with reported accuracy worse than this value. |
| `closureGapM` | 40 | metres | Maximum start-to-end distance for a route to count as closed. |
| `minAreaM2` | 2000 | square metres | Minimum polygon area for a loop to be accepted. |
| `minDistanceM` | 300 | metres | Minimum total route length for a loop to be accepted. |
| `minPoints` | 4 | points | Geometric guard: the minimum distinct usable points needed to attempt a ring. |
| `segmentContinuityGapM` | 10 | metres | Maximum distance between the last accepted point of one segment and the first accepted point of the next for them to belong to the same territory attempt. |

## Rationale

### `maxAccuracyM = 30`

Week 2 accepted points at 30 m accuracy in the mobile app, and the Week 2 field test
recorded approximately 8 m accuracy. Keeping the server threshold at 30 m matches the
existing client behaviour and rejects readings that are likely to distort the polygon.
Points with a missing `accuracy` value are not treated as zero-quality GPS: the spatial
analysis service keeps them and measures accuracy only when the field is present.

### `closureGapM = 40`

This matches the Week 2 proximity check (`LOOP_CLOSURE_THRESHOLD_METRES`) so the mobile
immediate signal and the authoritative server result agree. The Week 2 test walked a short
closed loop, but the longer Week 3 outdoor test must confirm that a real 300 m+ walk can
close within this gap.

### `minAreaM2 = 2000`

A 2,000 m² area is roughly a circle with a 25 m radius. The rule rejects courtyards, tiny
GPS jitter loops, and accidental closures while leaving room for a short neighbourhood
block loop. The spatial analysis service applies this threshold per polygon component after
`ST_MakeValid` splits or repairs the geometry, so a self-crossing loop can still produce one
qualifying component while below-threshold components are discarded.

### `minDistanceM = 300`

The Week 3 validation plan calls for a real walk of approximately 300 m or more. Requiring
at least 300 m filters trivial loops that could satisfy the area rule through GPS noise
alone. A route can fail both this rule and the area rule; multiple reasons are valid.

### `minPoints = 4`

`ST_MakePolygon` needs at least four positions (three distinct vertices plus a closing
coordinate). `minPoints` is only a geometric guard. It does not guarantee that four
arbitrary points form a useful loop, so the service verifies that there are enough
usable, distinct points after filtering and deduplication before building a ring.

### `segmentContinuityGapM = 10`

A running session contains pause/resume boundaries that produce separate route segments.
The distance between the last accepted point of the previous segment and the first accepted
point of the resumed segment decides continuity: strictly less than 10 m continues the same
territory attempt; 10 m or more finishes the attempt and starts a new one. The service never
fabricates or bridges GPS points across a large gap, and each territory attempt is analysed
independently. The Week 2 field test observed a visible gap between pre-pause and
post-resume segments; this threshold makes that observation an explicit rule rather than an
accidental artifact.

## Decision logic

The spatial analysis service (`server/src/services/spike.service.ts`) evaluates:

- `gapM > closureGapM` adds `NOT_CLOSED`.
- `areaM2 < minAreaM2` adds `AREA_TOO_SMALL`; this is only evaluated when the route is
  closed, because no geometry is constructed and no area is measured for an open route.
- `distanceM < minDistanceM` adds `DISTANCE_TOO_SHORT`.
- If there are fewer than `minPoints` usable distinct points, `TOO_FEW_POINTS` is added,
  the PostGIS query is skipped entirely, and the remaining thresholds are still evaluated
  with locally computed gap/distance so multiple applicable reasons are reported.

`isLoop` is true only when all required checks pass and the resulting geometry is valid
with positive area. When no valid polygon can be constructed for a closed route, `polygon`
is `null` and `areaM2` is `0`, which produces `AREA_TOO_SMALL` rather than a fabricated
polygon.

All lengths and areas are in metres and square metres. Route length, start-to-end gap, and
polygon area are calculated with PostGIS `geography` casts (SRID 4326, spheroid), never
from raw degrees. The start-to-end gap is measured on the original route before the ring is
artificially closed for polygon construction.

## Planned verification

Automated tests in Day 7 must cover, at minimum:

- A generated circular loop of about 100 m radius returns `isLoop: true` and an area near
  31,000 m² within a documented tolerance.
- A straight line returns `isLoop: false` with `NOT_CLOSED`.
- A gap just below and just above the 40 m boundary.
- A route shorter than 300 m returns `DISTANCE_TOO_SHORT`.
- A loop below 2,000 m² returns `AREA_TOO_SMALL` (additional reasons allowed).
- Too few usable distinct points returns `TOO_FEW_POINTS` without a database geometry error.
- Points with accuracy worse than 30 m are excluded and `pointsUsed` reflects the
  documented filtering and deduplication policy.
- Repeated adjacent points do not produce invalid geometry.
- GeoJSON coordinates use `[lng, lat]` and render at the expected location.

## Week 3 field evidence

This section will be updated after the Android emulator route replay and the real outdoor
walk on Day 6. Record observed accuracy, distance, start/end gap, area, and the final
recommendation for each threshold. Do not raise a threshold just to make one test pass;
record the evidence and the trade-off between false acceptance and false rejection.
