import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function Register(): React.JSX.Element {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(normalizedUsername)) {
      setError("Username must be 3-20 letters, numbers, or underscores");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Password must be 8-72 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(normalizedEmail, normalizedUsername, password);
      router.replace("/home");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.title}>Create account</Text>
        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Email" style={styles.input} value={email} />
        <TextInput autoCapitalize="none" onChangeText={setUsername} placeholder="Username" style={styles.input} value={username} />
        <TextInput onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={isSubmitting} onPress={() => void submit()} style={styles.button}>
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
        </Pressable>
        <Link href="/login" style={styles.link}>Already have an account? Log in</Link>
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
