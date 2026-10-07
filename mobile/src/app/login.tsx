import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Login(): React.JSX.Element {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace("/home");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>Log in</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Email" style={styles.input} value={email} />
        <TextInput onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={isSubmitting} onPress={() => void submit()} style={styles.button}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>
        <Link href="/register" style={styles.link}>Need an account? Register</Link>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", backgroundColor: "#2563eb", borderRadius: 8, padding: 14 },
  buttonText: { color: "#fff", fontWeight: "600" },
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  error: { color: "#b91c1c" },
  input: { borderColor: "#cbd5e1", borderRadius: 8, borderWidth: 1, padding: 12 },
  link: { color: "#2563eb", textAlign: "center" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
});
