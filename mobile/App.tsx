import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

/**
 * PadosiPro — your personal Lifestyle Manager.
 *
 * PadosiPro take-home assignment: the onboarding journey (register → verify →
 * login → profile → task selection → home) built natively in React Native.
 *
 * `GestureHandlerRootView` must wrap everything for Reanimated and
 * `react-native-screens` gestures to work, and `SafeAreaProvider` supplies the
 * insets every screen uses for its header.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
