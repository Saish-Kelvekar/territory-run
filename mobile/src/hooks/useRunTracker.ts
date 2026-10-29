import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { calculateRouteDistanceMetres, haversine, type GeoPoint } from "../utils/geo";
import type { LiveLocationPoint } from "./useLiveLocation";

export type RunStatus = "idle" | "running" | "paused" | "finished";

export type LoopResult = "closed" | "open" | "unavailable";

export type RunState = {
  status: RunStatus;
  startedAt: number | null;
  finishedAt: number | null;
  segmentStartedAt: number | null;
  elapsedMs: number;
  startPoint: GeoPoint | null;
  routeSegments: GeoPoint[][];
  distanceMetres: number;
  loopResult: LoopResult | null;
};

export type RunAction =
  | { type: "start"; at: number; point: GeoPoint | null }
  | { type: "append-points"; points: readonly GeoPoint[] }
  | { type: "pause"; at: number }
  | { type: "resume"; at: number }
  | { type: "finish"; at: number; finalPoint: GeoPoint | null };

export const initialRunState: RunState = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  segmentStartedAt: null,
  elapsedMs: 0,
  startPoint: null,
  routeSegments: [],
  distanceMetres: 0,
  loopResult: null,
};

type UseRunTrackerOptions = {
  acceptedPoints: readonly LiveLocationPoint[];
};

export type UseRunTrackerResult = RunState & {
  elapsedMs: number;
  latestEligiblePoint: LiveLocationPoint | null;
  loopDistanceMetres: number | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
};

export const LOOP_CLOSURE_THRESHOLD_METRES = 40;


const toGeoPoint = (point: LiveLocationPoint): GeoPoint => ({
  latitude: point.latitude,
  longitude: point.longitude,
});

const evaluateLoopResult = (
  startPoint: GeoPoint | null,
  finalPoint: GeoPoint | null,
): LoopResult => {
  if (startPoint === null || finalPoint === null) {
    return "unavailable";
  }

  return haversine(startPoint, finalPoint) <= LOOP_CLOSURE_THRESHOLD_METRES ? "closed" : "open";
};

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "start": {
      if (state.status === "running" || state.status === "paused") {
        return state;
      }

      const routeSegments = action.point ? [[action.point]] : [];

      return {
        status: "running",
        startedAt: action.at,
        finishedAt: null,
        segmentStartedAt: action.at,
        elapsedMs: 0,
        startPoint: action.point,
        routeSegments,
        distanceMetres: 0,
        loopResult: null,
      };
    }

    case "append-points": {
      if (state.status !== "running" || action.points.length === 0) {
        return state;
      }

      const routeSegments = state.routeSegments.slice();

      if (routeSegments.length === 0) {
        routeSegments.push([]);
      }

      const lastSegmentIndex = routeSegments.length - 1;
      const currentSegment = routeSegments[lastSegmentIndex];
      const distanceMetres =
        state.distanceMetres +
        calculateRouteDistanceMetres([...currentSegment.slice(-1), ...action.points]);

      routeSegments[lastSegmentIndex] = [...currentSegment, ...action.points];

      return {
        ...state,
        startPoint: state.startPoint ?? action.points[0] ?? null,
        routeSegments,
        distanceMetres,
      };
    }

    case "pause": {
      if (state.status !== "running") {
        return state;
      }

      const segmentStartedAt = state.segmentStartedAt ?? action.at;
      const elapsedMs = state.elapsedMs + Math.max(0, action.at - segmentStartedAt);

      return {
        ...state,
        status: "paused",
        segmentStartedAt: null,
        elapsedMs,
      };
    }

    case "resume": {
      if (state.status !== "paused") {
        return state;
      }

      return {
        ...state,
        status: "running",
        segmentStartedAt: action.at,
        routeSegments: [...state.routeSegments, []],
      };
    }

    case "finish": {
      if (state.status !== "running" && state.status !== "paused") {
        return state;
      }

      const elapsedMs =
        state.status === "running" && state.segmentStartedAt !== null
          ? state.elapsedMs + Math.max(0, action.at - state.segmentStartedAt)
          : state.elapsedMs;

      return {
        ...state,
        status: "finished",
        finishedAt: action.at,
        segmentStartedAt: null,
        elapsedMs,
        loopResult: evaluateLoopResult(state.startPoint, action.finalPoint),
      };
    }
  }
}

export function useRunTracker({ acceptedPoints }: UseRunTrackerOptions): UseRunTrackerResult {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const [now, setNow] = useState(() => Date.now());
  const processedPointCount = useRef(0);

  const latestEligiblePoint =
    acceptedPoints.length > 0 ? acceptedPoints[acceptedPoints.length - 1] : null;

  useEffect(() => {
    const pendingPoints = acceptedPoints.length - processedPointCount.current;

    if (pendingPoints > 0 && state.status === "running") {
      dispatch({
        type: "append-points",
        points: acceptedPoints.slice(processedPointCount.current).map(toGeoPoint),
      });
    }

    processedPointCount.current = acceptedPoints.length;
  }, [acceptedPoints, state.status]);

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [state.status]);

  const start = useCallback((): void => {
    const latestPoint = acceptedPoints.length > 0 ? acceptedPoints[acceptedPoints.length - 1] : null;
    processedPointCount.current = acceptedPoints.length;

    dispatch({
      type: "start",
      at: Date.now(),
      point: latestPoint ? toGeoPoint(latestPoint) : null,
    });
  }, [acceptedPoints]);

  const pause = useCallback((): void => {
    dispatch({ type: "pause", at: Date.now() });
  }, []);

  const resume = useCallback((): void => {
    dispatch({ type: "resume", at: Date.now() });
  }, []);

  const finish = useCallback((): void => {
    dispatch({
      type: "finish",
      at: Date.now(),
      finalPoint: latestEligiblePoint ? toGeoPoint(latestEligiblePoint) : null,
    });
  }, [latestEligiblePoint]);

  const elapsedMs =
    state.status === "running" && state.segmentStartedAt !== null
      ? state.elapsedMs + Math.max(0, now - state.segmentStartedAt)
      : state.elapsedMs;

  const loopDistanceMetres =
    state.startPoint && latestEligiblePoint
      ? haversine(state.startPoint, toGeoPoint(latestEligiblePoint))
      : null;

  return {
    ...state,
    elapsedMs,
    latestEligiblePoint,
    loopDistanceMetres,
    start,
    pause,
    resume,
    finish,
  };
}
