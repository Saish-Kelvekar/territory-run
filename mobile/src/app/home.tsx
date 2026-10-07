import { Redirect } from "expo-router";
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
  title: { fontSize: 26, fontWeight: "700" },
});
