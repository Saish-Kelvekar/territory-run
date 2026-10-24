import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from "@maplibre/maplibre-react-native";
import * as Linking from "expo-linking";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAP_STYLE_URL } from "../constants/map";
import { useAuth } from "../context/AuthContext";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { useLocationPermission } from "../hooks/useLocationPermission";
import { LOOP_CLOSURE_THRESHOLD_METRES, useRunTracker } from "../hooks/useRunTracker";
import { buildRouteLineString } from "../utils/geo";

const formatAccuracy = (accuracy: number | null): string =>
  accuracy === null ? "Unknown" : `${Math.round(accuracy)} m`;

const formatDuration = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
};

const formatDistance = (distanceMetres: number): string =>
  distanceMetres >= 1000
    ? `${(distanceMetres / 1000).toFixed(2)} km`
    : `${Math.round(distanceMetres)} m`;

export default function Run(): React.JSX.Element {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const { status, isPrecise } = useLocationPermission();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hasMapError, setHasMapError] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const canUseLocation = status === "granted" && isPrecise !== false;
  const {
    latestPoint,
    rawReadings,
    acceptedPoints,
    status: liveStatus,
    retry: retryLocation,
  } = useLiveLocation({ enabled: isAuthenticated && canUseLocation });
  const {
    status: runStatus,
    routeSegments,
    distanceMetres,
    elapsedMs,
    loopDistanceMetres,
    loopResult,
    start,
    pause,
    resume,
    finish,
  } = useRunTracker({ acceptedPoints });
  const routeLines = useMemo(
    () =>
      routeSegments.flatMap((segment, index) => {
        const data = buildRouteLineString(segment);

        return data ? [{ id: `run-route-${index}`, data }] : [];
      }),
    [routeSegments],
  );

  const retryMap = (): void => {
    setHasMapError(false);
    setIsMapLoaded(false);
    setMapKey((current) => current + 1);
  };

  const openSettings = (): void => {
    void Linking.openSettings();
  };

  if (isAuthLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (status === "denied" || status === "blocked" || (status === "granted" && isPrecise === false)) {
    return <Redirect href="/permission-needed" />;
  }

  const isCheckingPermission = status === "unknown";
  const isLocationLoading =
    isCheckingPermission ||
    (canUseLocation &&
      latestPoint === null &&
      liveStatus !== "services-disabled" &&
      liveStatus !== "error");

  const isNearStart =
    loopDistanceMetres !== null && loopDistanceMetres <= LOOP_CLOSURE_THRESHOLD_METRES;
  const loopValue =
    runStatus === "finished"
      ? loopResult === "closed"
        ? "Closed"
        : loopResult === "open"
          ? "Open"
          : "Unknown"
      : "—";
  const loopHint =
    runStatus === "finished"
      ? loopResult === "unavailable"
        ? "Missing location"
        : "Checked at finish"
      : runStatus === "idle"
        ? "Not started"
        : isNearStart
          ? "Near start"
          : loopDistanceMetres !== null
            ? `${Math.round(loopDistanceMetres)} m to start`
            : "Waiting for GPS";

  return (
    <View style={styles.container}>
      <Map
        key={mapKey}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        attribution
        logo
        onDidFinishLoadingMap={() => setIsMapLoaded(true)}
        onDidFailLoadingMap={() => {
          setIsMapLoaded(false);
          setHasMapError(true);
        }}
      >
        {routeLines.map((routeLine) => (
          <GeoJSONSource key={routeLine.id} id={routeLine.id} data={routeLine.data}>
            <Layer
              id={`${routeLine.id}-line`}
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.9 }}
            />
          </GeoJSONSource>
        ))}
        {latestPoint ? (
          <>
            <Camera center={[latestPoint.longitude, latestPoint.latitude]} zoom={16} />
            <Marker lngLat={[latestPoint.longitude, latestPoint.latitude]}>
              <View style={styles.marker} />
            </Marker>
          </>
        ) : null}
      </Map>

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      {!isMapLoaded && !hasMapError ? (
        <View pointerEvents="none" style={styles.topOverlay}>
          <View style={styles.mapLoadingBanner}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        </View>
      ) : null}

      {hasMapError ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Map unavailable</Text>
            <Text style={styles.cardText}>
              Could not load the map style. Check your internet connection and try again.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable onPress={retryMap} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Retry map</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {!hasMapError && isLocationLoading ? (
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator size="large" />
            <Text style={styles.cardTitle}>
              {isCheckingPermission ? "Checking location permission..." : "Finding your location..."}
            </Text>
            <Text style={styles.cardText}>
              {isCheckingPermission
                ? "Territory Run needs foreground location access to place you on the map."
                : "Waiting for the first GPS fix. This can take a few seconds outdoors."}
            </Text>
          </View>
        </View>
      ) : null}

      {!hasMapError && liveStatus === "services-disabled" ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location services are off</Text>
            <Text style={styles.cardText}>
              Turn on location services in your device settings, then try again.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable onPress={openSettings} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Open settings</Text>
              </Pressable>
              <Pressable onPress={retryLocation} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {!hasMapError && liveStatus === "error" ? (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Location unavailable</Text>
            <Text style={styles.cardText}>
              Could not get your current location. Move outdoors or check your location settings,
              then try again.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable onPress={retryLocation} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Retry location</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {!hasMapError && !isLocationLoading && liveStatus !== "error" && liveStatus !== "services-disabled" ? (
        <View style={styles.runPanel}>
          <View style={styles.runStats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Time</Text>
              <Text style={styles.statValue}>{formatDuration(elapsedMs)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>{formatDistance(distanceMetres)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Loop</Text>
              <Text
                style={[
                  styles.statValue,
                  runStatus === "finished" && loopResult === "closed" ? styles.loopClosed : null,
                ]}
              >
                {loopValue}
              </Text>
              <Text style={styles.statHint}>{loopHint}</Text>
            </View>
          </View>

          {latestPoint ? (
            <Text style={styles.gpsMeta}>
              GPS {formatAccuracy(latestPoint.accuracy)} · {acceptedPoints.length} accepted ·{" "}
              {rawReadings.length} raw
            </Text>
          ) : null}

          <View style={styles.runControls}>
            {runStatus === "idle" ? (
              <Pressable onPress={start} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start run</Text>
              </Pressable>
            ) : null}

            {runStatus === "running" ? (
              <>
                <Pressable onPress={pause} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Pause</Text>
                </Pressable>
                <Pressable onPress={finish} style={styles.dangerButton}>
                  <Text style={styles.dangerButtonText}>Finish</Text>
                </Pressable>
              </>
            ) : null}

            {runStatus === "paused" ? (
              <>
                <Pressable onPress={resume} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Resume</Text>
                </Pressable>
                <Pressable onPress={finish} style={styles.dangerButton}>
                  <Text style={styles.dangerButtonText}>Finish</Text>
                </Pressable>
              </>
            ) : null}

            {runStatus === "finished" ? (
              <Pressable onPress={start} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start new run</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.attribution}>
        <Text style={styles.attributionText}>
          © OpenStreetMap contributors · © OpenFreeMap · © OpenMapTiles
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  attribution: {
    alignItems: "center",
    bottom: 34,
    left: 12,
    position: "absolute",
    right: 12,
  },
  attributionText: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 4,
    color: "#475569",
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 8,
    elevation: 3,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: "absolute",
    top: 48,
  },
  backButtonText: {
    color: "#1e293b",
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 4,
    gap: 12,
    maxWidth: 360,
    padding: 20,
    width: "100%",
  },
  cardText: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapLoadingBanner: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 999,
    elevation: 2,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  mapLoadingText: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "600",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    flex: 1,
    padding: 14,
  },
  dangerButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  gpsMeta: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },
  loopClosed: {
    color: "#15803d",
  },
  marker: {
    backgroundColor: "#2563eb",
    borderColor: "#fff",
    borderRadius: 10,
    borderWidth: 3,
    elevation: 4,
    height: 20,
    width: 20,
  },
  overlay: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    padding: 24,
    position: "absolute",
    right: 0,
    top: 0,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    flex: 1,
    padding: 14,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "600",
  },
  runControls: {
    flexDirection: "row",
    gap: 12,
  },
  runPanel: {
    backgroundColor: "rgba(255, 255, 255, 0.97)",
    borderRadius: 12,
    bottom: 62,
    elevation: 4,
    gap: 10,
    left: 16,
    padding: 14,
    position: "absolute",
    right: 16,
  },
  runStats: {
    flexDirection: "row",
  },
  stat: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statHint: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  topOverlay: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 48,
  },
});
