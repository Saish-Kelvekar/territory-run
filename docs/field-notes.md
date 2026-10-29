# Field Notes: Outdoor GPS Test

## Overview

- **Date:** 29 October 2026
- **Type:** Outdoor GPS tracking test (real device, on foot)
- **Scope:** GPS accuracy, point acceptance, distance and duration tracking, loop detection, and pause/resume behavior.

> Note: Loop-area calculation and territory claiming were **not** tested. These features have not yet been implemented.

## Results

| Metric | Result |
| --- | --- |
| GPS accuracy | 8 m |
| Raw GPS points | 16 |
| Accepted GPS points | 16 |
| Recorded distance | 49 m |
| Recorded duration | 2 minutes 24 seconds |
| Loop result | Closed |

## Pause/Resume

Distance tracking stopped while the run was paused and resumed correctly afterward.

## Observed Issue

The route displayed a disconnection between the pre-pause and post-resume track segments: the two segments are not visually joined in the displayed path.

### Investigation needed

- Confirm whether the app draws separate polylines per segment or a single polyline across all points.
- Check whether points recorded immediately before pausing and after resuming are being filtered out (e.g., near-duplicate points or an accuracy filter), leaving a gap.
- Decide the intended behavior: either connect pre-pause and post-resume segments in the drawn route, or explicitly render a visible break at the pause point.

## Suspected Causes & Proposed Improvements

These are not confirmed bugs — they are hypotheses to check:

- **Suspected:** the displayed route is drawn from separate segment arrays instead of combining all accepted points, so nothing bridges the pause gap.
- **Suspected:** a pause boundary condition drops or skips a point on resume, causing the visual disconnect.
- **Proposed improvement:** after the above investigation, either bridge the segments in the drawn route or render an explicit break marker at the pause point so the disconnect is deliberate rather than accidental.
- **Proposed improvement:** add a reproducible in-app or scripted way to capture the raw and accepted point lists around a pause/resume, to make the root cause easier to confirm.

## Notes

- 16/16 raw points accepted, so no points were dropped by the accuracy filter during this test.
- Distance (49 m) and duration (2 m 24 s) appear consistent with a short walk; distance behavior across pause/resume was correct.
- Loop detection reported a closed loop.
