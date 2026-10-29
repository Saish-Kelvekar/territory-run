import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Home(): React.JSX.Element {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }
  if (!isAuthenticated || !user) {
    return <Redirect href="/login" />;
  }

  const signOut = async (): Promise<void> => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user.username}</Text>
      <Text>Email: {user.email}</Text>
      <Pressable onPress={() => router.push("/run")} style={styles.runButton}>
        <Text style={styles.buttonText}>Open run map</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/permission-needed")} style={styles.secondaryButton}>
        <Text>Check location permission</Text>
      </Pressable>
      <Pressable disabled={isLoggingOut} onPress={() => void signOut()} style={styles.button}>
        {isLoggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log out</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", backgroundColor: "#334155", borderRadius: 8, marginTop: 16, padding: 14 },
  buttonText: { color: "#fff", fontWeight: "600" },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  loader: { flex: 1 },
  runButton: { alignItems: "center", backgroundColor: "#2563eb", borderRadius: 8, padding: 14 },
  secondaryButton: { alignItems: "center", borderColor: "#cbd5e1", borderRadius: 8, borderWidth: 1, padding: 14 },
  title: { fontSize: 26, fontWeight: "700" },
});
