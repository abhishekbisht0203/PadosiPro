import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '../theme';
import { displayFont } from '../theme';

/**
 * Splash.
 *
 * Shown only while the stored session is being checked, which is usually a few
 * hundred milliseconds. The mark draws itself and the wordmark settles in behind
 * it, so the wait reads as an intentional opening rather than a stall.
 */
export function SplashScreen() {
  const mark = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    mark.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.4)) });

    wordmark.value = withDelay(
      260,
      withTiming(1, { duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );

    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [breathe, mark, wordmark]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + 0.5 * mark.value }, { rotate: `${(1 - mark.value) * -18}deg` }],
    opacity: mark.value,
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 10 }],
  }));

  const breatheStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.2 * breathe.value,
    transform: [{ scale: 1 + 0.12 * breathe.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, breatheStyle]} />

      <Animated.View style={[styles.mark, markStyle]}>
        <Feather name="check" size={30} color={colors.textInverse} />
      </Animated.View>

      <Animated.View style={wordmarkStyle}>
        <Text style={styles.wordmark}>PadosiPro</Text>
        <Text style={styles.tagline}>You don't manage tasks — we do.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.mint,
    top: '28%',
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: displayFont,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  tagline: { ...typography.bodySmall, textAlign: 'center', marginTop: spacing.xs },
});
