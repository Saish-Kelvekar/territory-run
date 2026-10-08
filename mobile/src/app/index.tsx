import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Index(): React.JSX.Element {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/home" : "/login"} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
