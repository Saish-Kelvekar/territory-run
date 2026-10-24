import {
  buildRouteLineString,
  calculateRouteDistanceMetres,
  EARTH_RADIUS_METRES,
  haversine,
} from "../geo";

describe("haversine", () => {
  it("returns zero for identical points", () => {
    expect(haversine({ latitude: 51.5072, longitude: -0.1276 }, { latitude: 51.5072, longitude: -0.1276 })).toBe(0);
  });

  it("calculates one degree of latitude at the equator", () => {
    const distance = haversine({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });

    expect(distance).toBeCloseTo((EARTH_RADIUS_METRES * Math.PI) / 180, 5);
  });

  it("calculates the distance between London and Paris", () => {
    const distance = haversine(
      { latitude: 51.5072, longitude: -0.1276 },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(distance).toBeGreaterThan(343_000);
    expect(distance).toBeLessThan(344_000);
  });

  it("is symmetric", () => {
    const london = { latitude: 51.5072, longitude: -0.1276 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };

    expect(haversine(london, paris)).toBeCloseTo(haversine(paris, london), 6);
  });

  it("handles points across the antimeridian", () => {
    const distance = haversine({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 });

    expect(distance).toBeCloseTo((EARTH_RADIUS_METRES * Math.PI * 0.2) / 180, 3);
  });
});

describe("calculateRouteDistanceMetres", () => {
  it("returns zero for zero or one point", () => {
    expect(calculateRouteDistanceMetres([])).toBe(0);
    expect(calculateRouteDistanceMetres([{ latitude: 1, longitude: 2 }])).toBe(0);
  });

  it("sums consecutive point distances", () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 0, longitude: 2 },
    ];

    expect(calculateRouteDistanceMetres(points)).toBeCloseTo(
      2 * haversine(points[0], points[1]),
      6,
    );
  });
});

describe("buildRouteLineString", () => {
  it("returns null for zero or one point", () => {
    expect(buildRouteLineString([])).toBeNull();
    expect(buildRouteLineString([{ latitude: 1, longitude: 2 }])).toBeNull();
  });

  it("uses longitude-latitude coordinate order", () => {
    const lineString = buildRouteLineString([
      { latitude: 51.5072, longitude: -0.1276 },
      { latitude: 48.8566, longitude: 2.3522 },
    ]);

    expect(lineString).toEqual({
      type: "LineString",
      coordinates: [
        [-0.1276, 51.5072],
        [2.3522, 48.8566],
      ],
    });
  });
});
