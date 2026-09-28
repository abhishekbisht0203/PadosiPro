import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TaskSelectionScreen } from '../screens/TaskSelectionScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { colors } from '../theme';

/**
 * The navigator.
 *
 * AuthContext owns the journey state as a single `stage`, and this component
 * maps it onto screens. That is a deliberate trade-off: a real navigation library
 * with a proper back stack would be the next step (see DESIGN.md), but for a
 * one-way funnel — welcome → verify → profile → tasks → home — declarative
 * routing removes a whole category of bug (a back gesture into a screen whose
 * preconditions no longer hold) and keeps every transition animated.
 */
export function RootNavigator() {
  const { stage, initialising } = useAuth();

  if (initialising) return <SplashScreen />;

  return (
    <View style={styles.root}>
      {stage === 'welcome' ? <AuthScreen /> : null}
      {stage === 'verify' ? <VerifyScreen /> : null}
      {stage === 'profile' ? <ProfileScreen /> : null}
      {stage === 'tasks' ? <TaskSelectionScreen /> : null}
      {stage === 'home' ? <HomeScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
