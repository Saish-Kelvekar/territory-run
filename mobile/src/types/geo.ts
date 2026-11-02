import type { MultiPolygon } from "geojson";

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
  polygon: MultiPolygon | null;
};

export type LoopAnalysisRequest = {
  points: LatLngPoint[];
};
