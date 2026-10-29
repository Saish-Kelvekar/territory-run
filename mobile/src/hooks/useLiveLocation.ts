import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

const ACCURACY_THRESHOLD_METERS = 30;
const DISTANCE_INTERVAL_METERS = 5;

export type LiveLocationPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LiveLocationStatus = "idle" | "starting" | "tracking" | "services-disabled" | "error";

export type UseLiveLocationResult = {
  latestPoint: LiveLocationPoint | null;
  rawReadings: LiveLocationPoint[];
  acceptedPoints: LiveLocationPoint[];
  status: LiveLocationStatus;
  error: string | null;
  retry: () => void;
};

type UseLiveLocationOptions = {
  enabled?: boolean;
};

export function useLiveLocation({ enabled = true }: UseLiveLocationOptions = {}): UseLiveLocationResult {
  const [latestPoint, setLatestPoint] = useState<LiveLocationPoint | null>(null);
  const [rawReadings, setRawReadings] = useState<LiveLocationPoint[]>([]);
  const [acceptedPoints, setAcceptedPoints] = useState<LiveLocationPoint[]>([]);
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback((): void => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async (): Promise<void> => {
      setStatus("starting");
      setError(null);

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!isActive) {
          return;
        }

        if (!servicesEnabled) {
          setStatus("services-disabled");
          return;
        }

        const createdSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: DISTANCE_INTERVAL_METERS,
          },
          (location) => {
            if (!isActive) {
              return;
            }

            const point: LiveLocationPoint = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              timestamp: location.timestamp,
            };

            setLatestPoint(point);
            setRawReadings((current) => [...current, point]);

            if (point.accuracy !== null && point.accuracy <= ACCURACY_THRESHOLD_METERS) {
              setAcceptedPoints((current) => [...current, point]);
            }
          },
          (reason) => {
            if (!isActive) {
              return;
            }

            setStatus("error");
            setError(reason || "Location updates stopped unexpectedly.");
          },
        );

        if (!isActive) {
          createdSubscription.remove();
          return;
        }

        subscription = createdSubscription;
        setStatus("tracking");
      } catch (startError) {
        if (!isActive) {
          return;
        }

        setStatus("error");
        setError(
          startError instanceof Error
            ? startError.message
            : "Unable to start live location tracking.",
        );
      }
    };

    void startWatching();

    return () => {
      isActive = false;
      subscription?.remove();
      subscription = null;
    };
  }, [enabled, attempt]);

  return {
    latestPoint,
    rawReadings,
    acceptedPoints,
    status: enabled ? status : "idle",
    error: enabled ? error : null,
    retry,
  };
}
