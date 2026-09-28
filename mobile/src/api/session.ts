import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'padosipro.session.v1';

/**
 * Session persistence.
 *
 * A returning user must stay signed in after restarting the app, so the token
 * is written to AsyncStorage the moment it is issued and read back on cold
 * start. `GET /me` then revalidates it against the server — a token that has
 * expired or been tampered with is discarded rather than trusted locally.
 */
export const sessionStore = {
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async loadToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing useful to do if storage fails during logout; the in-memory
      // token has already been dropped by the caller.
    }
  },
};
