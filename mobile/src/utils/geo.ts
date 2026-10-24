import type { LineString } from "geojson";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export const EARTH_RADIUS_METRES = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversine(from: GeoPoint, to: GeoPoint): number {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);

  const sinLatitude = Math.sin(latitudeDelta / 2);
  const sinLongitude = Math.sin(longitudeDelta / 2);
  const a =
    sinLatitude * sinLatitude +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * sinLongitude * sinLongitude;
  const clamped = Math.min(1, Math.max(0, a));

  return 2 * EARTH_RADIUS_METRES * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

export function calculateRouteDistanceMetres(points: readonly GeoPoint[]): number {
  let distance = 0;

  for (let index = 1; index < points.length; index += 1) {
    distance += haversine(points[index - 1], points[index]);
  }

  return distance;
}

export function buildRouteLineString(points: readonly GeoPoint[]): LineString | null {
  if (points.length < 2) {
    return null;
  }

  return {
    type: "LineString",
    coordinates: points.map((point): [number, number] => [point.longitude, point.latitude]),
  };
}
