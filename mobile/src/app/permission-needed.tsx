import { router } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocationPermission } from "../hooks/useLocationPermission";

export default function PermissionNeeded(): React.JSX.Element {
  const { status, isPrecise, requestPermission } = useLocationPermission();

  const openSettings = (): void => {
    void Linking.openSettings();
  };

  if (status === "unknown") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Checking location permission...</Text>
      </View>
    );
  }

  if (status === "granted" && isPrecise) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Location ready</Text>
        <Text style={styles.message}>Precise location is enabled for tracking runs and claiming territory.</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (status === "granted") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Precise location required</Text>
        <Text style={styles.message}>
          Territory Run needs precise location to track runs accurately and claim territory.
        </Text>
        <Pressable onPress={openSettings} style={styles.button}>
          <Text style={styles.buttonText}>Open settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location permission needed</Text>
      <Text style={styles.message}>
        Location lets Territory Run track your runs and helps you claim territory.
      </Text>
      {status === "denied" ? (
        <Pressable onPress={() => void requestPermission()} style={styles.button}>
          <Text style={styles.buttonText}>Grant permission</Text>
        </Pressable>
      ) : (
        <Pressable onPress={openSettings} style={styles.button}>
          <Text style={styles.buttonText}>Open settings</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    marginTop: 16,
    padding: 14,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  message: { color: "#475569", fontSize: 16, lineHeight: 24 },
  title: { fontSize: 26, fontWeight: "700" },
});
