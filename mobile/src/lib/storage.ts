import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "territory_run_token";

export const getToken = (): Promise<string | null> => {
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const saveToken = (token: string): Promise<void> => {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const removeToken = (): Promise<void> => {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
};
