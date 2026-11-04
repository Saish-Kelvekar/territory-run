import type { LineString, MultiPolygon } from "geojson";
import { RULES } from "../config/rules.js";
import { pool } from "../db/pool.js";
import type { LatLngPoint, LoopReason, LoopResult } from "../types/geo.js";

const EARTH_RADIUS_METRES = 6_371_000;

const LOOP_ANALYSIS_SQL = `
WITH cleaned AS (
  SELECT ST_RemoveRepeatedPoints(ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326)) AS line
),
metrics AS (
  SELECT
    line AS route,
    ST_Length(line::geography) AS distance_m,
    ST_Distance(ST_StartPoint(line)::geography, ST_EndPoint(line)::geography) AS gap_m
  FROM cleaned
),
ring_candidates AS (
  SELECT
    route,
    distance_m,
    gap_m,
    CASE
      WHEN ST_IsClosed(route) THEN route
      ELSE ST_AddPoint(route, ST_StartPoint(route))
    END AS ring
  FROM metrics
),
closed AS (
  SELECT route, distance_m, gap_m, ring
  FROM ring_candidates
  WHERE gap_m <= $2::double precision
    AND ST_NumPoints(ring) >= 4
),
polygon AS (
  SELECT route, distance_m, gap_m, ST_MakePolygon(ring) AS polygon
  FROM closed
),
components AS (
  SELECT (ST_Dump(ST_MakeValid(polygon))).geom AS component
  FROM polygon
),
kept AS (
  SELECT component
  FROM components
  WHERE ST_GeometryType(component) = 'ST_Polygon'
    AND ST_Area(component::geography) >= $3::double precision
),
summary AS (
  SELECT COALESCE(SUM(ST_Area(component::geography)), 0) AS area_m2
  FROM kept
)
SELECT
  metrics.distance_m AS "distanceM",
  metrics.gap_m AS "gapM",
  summary.area_m2 AS "areaM2",
  (SELECT ST_AsGeoJSON(ST_Multi(ST_Collect(component))) FROM kept) AS "polygonJson"
FROM metrics
CROSS JOIN summary
`;

type LoopAnalysisRow = {
  distanceM: number | null;
  gapM: number | null;
  areaM2: number | null;
  polygonJson: string | null;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const haversineMetres = (from: LatLngPoint, to: LatLngPoint): number => {
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);

  const sinLatitude = Math.sin(latitudeDelta / 2);
  const sinLongitude = Math.sin(longitudeDelta / 2);
  const a =
    sinLatitude * sinLatitude +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * sinLongitude * sinLongitude;
  const clamped = Math.min(1, Math.max(0, a));

  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
};

const routeDistanceMetres = (points: readonly LatLngPoint[]): number => {
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    distance += haversineMetres(points[index - 1], points[index]);
  }

  return distance;
};

const isValidCoordinate = (point: LatLngPoint): boolean =>
  Number.isInteger(point.t) &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  point.lat >= -90 &&
  point.lat <= 90 &&
  point.lng >= -180 &&
  point.lng <= 180;

const isAccurateEnough = (point: LatLngPoint): boolean => {
  if (point.accuracy === undefined) {
    return true;
  }
  return (
    Number.isFinite(point.accuracy) &&
    point.accuracy >= 0 &&
    point.accuracy <= RULES.maxAccuracyM
  );
};

const isSameCoordinate = (a: LatLngPoint, b: LatLngPoint): boolean =>
  a.lat === b.lat && a.lng === b.lng;

const preparePoints = (points: readonly LatLngPoint[]): LatLngPoint[] => {
  const valid = points.filter((point) => isValidCoordinate(point) && isAccurateEnough(point));
  const sorted = [...valid].sort((a, b) => a.t - b.t);
  const deduped: LatLngPoint[] = [];

  for (const point of sorted) {
    const previous = deduped[deduped.length - 1];
    if (previous && isSameCoordinate(previous, point)) {
      continue;
    }
    deduped.push(point);
  }

  return deduped;
};

const distinctCoordinateCount = (points: readonly LatLngPoint[]): number =>
  new Set(points.map((point) => `${point.lat},${point.lng}`)).size;

const mergeContinuousSegments = (
  segments: readonly (readonly LatLngPoint[])[],
): LatLngPoint[][] => {
  const attempts: LatLngPoint[][] = [];
  let current: LatLngPoint[] = [];

  for (const segment of segments) {
    const prepared = preparePoints(segment);

    if (prepared.length === 0) {
      continue;
    }

    if (current.length === 0) {
      current = [...prepared];
      continue;
    }

    const gapM = haversineMetres(current[current.length - 1], prepared[0]);

    if (gapM < RULES.segmentContinuityGapM) {
      current = [...current, ...prepared];
    } else {
      attempts.push(current);
      current = [...prepared];
    }
  }

  if (current.length > 0) {
    attempts.push(current);
  }

  return attempts;
};

const closureAndDistanceReasons = (distanceM: number, gapM: number): LoopReason[] => {
  const reasons: LoopReason[] = [];

  if (gapM > RULES.closureGapM) {
    reasons.push("NOT_CLOSED");
  }
  if (distanceM < RULES.minDistanceM) {
    reasons.push("DISTANCE_TOO_SHORT");
  }

  return reasons;
};

const unmeasurableLoopResult = (
  usable: readonly LatLngPoint[],
  distanceM: number,
  gapM: number,
  reasons: LoopReason[],
): LoopResult => ({
  isLoop: false,
  reasons,
  distanceM,
  gapM,
  areaM2: 0,
  pointsUsed: usable.length,
  polygon: null,
});

const parseMultiPolygon = (json: string | null): MultiPolygon | null => {
  if (json === null || json === "") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null && (parsed as { type?: unknown }).type === "MultiPolygon") {
      return parsed as MultiPolygon;
    }
    return null;
  } catch {
    return null;
  }
};

export const analyzeLoop = async (points: readonly LatLngPoint[]): Promise<LoopResult> => {
  const usable = preparePoints(points);
  const distinctCoordinates = distinctCoordinateCount(usable);

  if (usable.length < RULES.minPoints || distinctCoordinates < RULES.minPoints) {
    const distanceM = routeDistanceMetres(usable);
    const gapM = usable.length >= 2 ? haversineMetres(usable[0], usable[usable.length - 1]) : 0;
    const reasons = [...closureAndDistanceReasons(distanceM, gapM), "TOO_FEW_POINTS" as const];

    return unmeasurableLoopResult(usable, distanceM, gapM, reasons);
  }

  const lineString: LineString = {
    type: "LineString",
    coordinates: usable.map((point): [number, number] => [point.lng, point.lat]),
  };

  const result = await pool.query<LoopAnalysisRow>(LOOP_ANALYSIS_SQL, [
    JSON.stringify(lineString),
    RULES.closureGapM,
    RULES.minAreaM2,
  ]);

  const row = result.rows[0];
  const distanceM = Number(row.distanceM ?? 0);
  const gapM = Number(row.gapM ?? 0);
  const areaM2 = Number(row.areaM2 ?? 0);
  const polygon = parseMultiPolygon(row.polygonJson ?? null);

  const reasons: LoopReason[] = [];

  if (gapM > RULES.closureGapM) {
    reasons.push("NOT_CLOSED");
  } else if (areaM2 < RULES.minAreaM2) {
    reasons.push("AREA_TOO_SMALL");
  }
  if (distanceM < RULES.minDistanceM) {
    reasons.push("DISTANCE_TOO_SHORT");
  }

  return {
    isLoop: reasons.length === 0 && polygon !== null,
    reasons,
    distanceM,
    gapM,
    areaM2,
    pointsUsed: usable.length,
    polygon,
  };
};

export const analyzeSession = async (
  segments: readonly (readonly LatLngPoint[])[],
): Promise<LoopResult[]> => {
  const attempts = mergeContinuousSegments(segments);

  return Promise.all(attempts.map((attempt) => analyzeLoop(attempt)));
};
