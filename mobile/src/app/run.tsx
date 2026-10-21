import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import * as Linking from "expo-linking";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAP_STYLE_URL } from "../constants/map";
import { useAuth } from "../context/AuthContext";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { useLocationPermission } from "../hooks/useLocationPermission";

const formatAccuracy = (accuracy: number | null): string =>
  accuracy === null ? "Unknown" : `${Math.round(accuracy)} m`;

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

      {!hasMapError && liveStatus !== "error" && liveStatus !== "services-disabled" && latestPoint ? (
        <View pointerEvents="none" style={styles.liveStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Accuracy</Text>
            <Text style={styles.statValue}>{formatAccuracy(latestPoint.accuracy)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Accepted</Text>
            <Text style={styles.statValue}>{acceptedPoints.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Raw</Text>
            <Text style={styles.statValue}>{rawReadings.length}</Text>
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
  liveStats: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 10,
    bottom: 62,
    elevation: 2,
    flexDirection: "row",
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
    right: 16,
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
  stat: {
    alignItems: "center",
    flex: 1,
    gap: 2,
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
