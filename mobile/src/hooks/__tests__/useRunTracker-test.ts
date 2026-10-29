import { EARTH_RADIUS_METRES, haversine, type GeoPoint } from "../../utils/geo";
import {
  initialRunState,
  runReducer,
  type RunAction,
  type RunState,
} from "../useRunTracker";

const pointEast = (metres: number, latitude = 0): GeoPoint => ({
  latitude,
  longitude: (metres / EARTH_RADIUS_METRES) * (180 / Math.PI),
});

const apply = (
  actions: readonly RunAction[],
  state: RunState = initialRunState,
): RunState => actions.reduce(runReducer, state);

const start = (at: number, point: GeoPoint | null): RunAction => ({
  type: "start",
  at,
  point,
});

const append = (...points: GeoPoint[]): RunAction => ({
  type: "append-points",
  points,
});

const pause = (at: number): RunAction => ({ type: "pause", at });

const resume = (at: number): RunAction => ({ type: "resume", at });

const finish = (at: number, finalPoint: GeoPoint | null): RunAction => ({
  type: "finish",
  at,
  finalPoint,
});

describe("runReducer route segments", () => {
  it("calculates distance within a single segment", () => {
    const first = pointEast(0);
    const second = pointEast(100);
    const third = pointEast(250);
    const state = apply([start(0, first), append(second), append(third)]);

    expect(state.routeSegments).toEqual([[first, second, third]]);
    expect(state.distanceMetres).toBeCloseTo(
      haversine(first, second) + haversine(second, third),
      6,
    );
  });

  it("does not count distance across segment boundaries", () => {
    const beforePauseStart = pointEast(0);
    const beforePauseEnd = pointEast(100);
    const afterResumeStart = pointEast(5_000);
    const afterResumeEnd = pointEast(5_100);
    const state = apply([
      start(0, beforePauseStart),
      append(beforePauseEnd),
      pause(1_000),
      resume(2_000),
      append(afterResumeStart, afterResumeEnd),
    ]);

    expect(state.routeSegments).toEqual([
      [beforePauseStart, beforePauseEnd],
      [afterResumeStart, afterResumeEnd],
    ]);
    expect(state.distanceMetres).toBeCloseTo(
      haversine(beforePauseStart, beforePauseEnd) +
        haversine(afterResumeStart, afterResumeEnd),
      6,
    );
    expect(state.distanceMetres).toBeLessThan(
      haversine(beforePauseEnd, afterResumeStart),
    );
  });

  it("preserves points recorded before pausing after resuming", () => {
    const first = pointEast(0);
    const second = pointEast(100);
    const pausedState = apply([
      start(0, first),
      append(second),
      pause(1_000),
    ]);
    const resumedState = runReducer(pausedState, resume(2_000));

    expect(resumedState.routeSegments).toEqual([[first, second], []]);
    expect(resumedState.distanceMetres).toBeCloseTo(haversine(first, second), 6);
  });

  it("preserves all segments across multiple pause and resume cycles", () => {
    const points = [
      pointEast(0),
      pointEast(100),
      pointEast(5_000),
      pointEast(5_100),
      pointEast(9_000),
      pointEast(9_100),
    ];
    const state = apply([
      start(0, points[0]),
      append(points[1]),
      pause(1_000),
      resume(2_000),
      append(points[2], points[3]),
      pause(3_000),
      resume(4_000),
      append(points[4], points[5]),
    ]);

    expect(state.routeSegments).toEqual([
      [points[0], points[1]],
      [points[2], points[3]],
      [points[4], points[5]],
    ]);
    expect(state.distanceMetres).toBeCloseTo(
      haversine(points[0], points[1]) +
        haversine(points[2], points[3]) +
        haversine(points[4], points[5]),
      6,
    );
  });

  it("ignores GPS readings received while paused", () => {
    const first = pointEast(0);
    const second = pointEast(100);
    const pausedState = apply([
      start(0, first),
      append(second),
      pause(1_000),
    ]);
    const afterPausedReading = runReducer(pausedState, append(pointEast(5_000)));

    expect(afterPausedReading).toBe(pausedState);
    expect(afterPausedReading.routeSegments).toEqual([[first, second]]);
    expect(afterPausedReading.distanceMetres).toBeCloseTo(
      haversine(first, second),
      6,
    );
  });
});

describe("runReducer loop completion", () => {
  it("does not report a loop result before finishing", () => {
    const startPoint = pointEast(0);
    const state = apply([
      start(0, startPoint),
      append(pointEast(10)),
      pause(1_000),
      resume(2_000),
    ]);

    expect(state.loopResult).toBeNull();
  });

  it("marks the loop closed when finishing within 40 metres", () => {
    const startPoint = pointEast(0);
    const state = apply([
      start(0, startPoint),
      append(pointEast(100)),
      finish(5_000, pointEast(40)),
    ]);

    expect(state.loopResult).toBe("closed");
  });

  it("marks the loop open when finishing beyond 40 metres", () => {
    const startPoint = pointEast(0);
    const state = apply([
      start(0, startPoint),
      append(pointEast(100)),
      finish(5_000, pointEast(40.001)),
    ]);

    expect(state.loopResult).toBe("open");
  });

  it("does not produce a closed loop when a location is missing", () => {
    const missingStart = apply([
      start(0, null),
      finish(1_000, pointEast(10)),
    ]);
    const missingFinal = apply([
      start(0, pointEast(0)),
      finish(1_000, null),
    ]);

    expect(missingStart.loopResult).toBe("unavailable");
    expect(missingFinal.loopResult).toBe("unavailable");
  });

  it("freezes the finished loop result and metrics after later GPS updates", () => {
    const startPoint = pointEast(0);
    const finishedState = apply([
      start(0, startPoint),
      append(pointEast(100)),
      finish(5_000, pointEast(10)),
    ]);
    const afterLateReading = runReducer(finishedState, append(pointEast(1_000)));

    expect(finishedState.loopResult).toBe("closed");
    expect(afterLateReading).toBe(finishedState);
    expect(afterLateReading.distanceMetres).toBe(finishedState.distanceMetres);
    expect(afterLateReading.elapsedMs).toBe(finishedState.elapsedMs);
    expect(afterLateReading.routeSegments).toEqual(finishedState.routeSegments);
  });
});

describe("runReducer elapsed time", () => {
  it("excludes paused time from the elapsed duration", () => {
    const state = apply([
      start(0, pointEast(0)),
      pause(10_000),
      resume(20_000),
      finish(25_000, pointEast(0)),
    ]);

    expect(state.elapsedMs).toBe(15_000);
  });
});
