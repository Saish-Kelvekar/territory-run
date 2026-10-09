import { PermissionStatus } from "expo";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

export type LocationPermissionStatus = "unknown" | "granted" | "denied" | "blocked";

type LocationPermissionState = {
  status: LocationPermissionStatus;
  isPrecise: boolean | null;
};

type LocationPermission = LocationPermissionState & {
  requestPermission: () => Promise<void>;
};

const getPermissionState = (permission: Location.LocationPermissionResponse): LocationPermissionState => {
  if (permission.status !== PermissionStatus.GRANTED) {
    return {
      status: permission.canAskAgain ? "denied" : "blocked",
      isPrecise: null,
    };
  }

  const accuracy = permission.android?.accuracy ?? permission.ios?.accuracy;
const isPrecise: boolean | null =
  accuracy === undefined ? null : accuracy === "fine" || accuracy === "full";

  return {
    status: "granted",
    isPrecise: isPrecise ?? null,
  };
};

export function useLocationPermission(): LocationPermission {
  const [permission, setPermission] = useState<LocationPermissionState>({
    status: "unknown",
    isPrecise: null,
  });
  const isMounted = useRef(true);

  const requestPermission = useCallback(async (): Promise<void> => {
    const requestedPermission = await Location.requestForegroundPermissionsAsync();
    
    if (isMounted.current) {
      setPermission(getPermissionState(requestedPermission));
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    const checkWhileMounted = async (): Promise<void> => {
      const currentPermission = await Location.getForegroundPermissionsAsync();
     
      if (isMounted.current) {
        setPermission(getPermissionState(currentPermission));
      }
    };

    const handleAppStateChange = (nextState: AppStateStatus): void => {
      if (nextState === "active") {
        void checkWhileMounted();
      }
    };

    void checkWhileMounted();
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      isMounted.current = false;
      subscription.remove();
    };
  }, []);

  return { ...permission, requestPermission };
}
