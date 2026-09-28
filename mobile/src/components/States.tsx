import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radii, spacing, typography } from '../theme';
import { PrimaryButton } from './PrimaryButton';

/**
 * Shimmering placeholder.
 *
 * A spinner alone tells a user something is happening; a skeleton tells them
 * what is about to arrive, which makes the wait feel shorter and avoids the
 * layout jump when real content replaces it.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.45, 0.85, 0.45]),
  }));

  return <Animated.View style={[styles.skeleton, { width, height, borderRadius }, animatedStyle, style]} />;
}

/** Placeholder shaped like the task list it stands in for. */
export function TaskListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading tasks">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} borderRadius={radii.md} />
          <View style={styles.skeletonBody}>
            <Skeleton width="72%" height={13} />
            <Skeleton width="90%" height={11} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Error state with a retry.
 *
 * Every screen that talks to the network has one of these, so a failed request
 * always has somewhere to go. The message comes from the API, which means it
 * says the actually useful thing ("Cannot reach the server at ...") rather than
 * a generic apology.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  compact = false,
  style,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={[styles.stateBox, compact && styles.stateCompact, style]}>
      <View style={styles.stateIconError}>
        <Feather name="wifi-off" size={compact ? 18 : 24} color={colors.error} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry ? (
        <View style={styles.stateAction}>
          <PrimaryButton label={retryLabel} onPress={onRetry} variant="secondary" icon="refresh-cw" fullWidth={false} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Empty state, used for "no tasks selected yet" and empty search results. */
export function EmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  style,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={[styles.stateBox, compact && styles.stateCompact, style]}>
      <View style={styles.stateIconNeutral}>
        <Feather name={icon} size={compact ? 20 : 28} color={colors.primary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.stateAction}>
          <PrimaryButton label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Inline banner for warnings and non-blocking problems. */
export function InlineBanner({
  tone = 'info',
  message,
  onDismiss,
  style,
}: {
  tone?: 'info' | 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const config = {
    info: { bg: colors.mintSoft, fg: colors.primary, icon: 'info' as const },
    error: { bg: colors.errorSoft, fg: colors.error, icon: 'alert-circle' as const },
    success: { bg: colors.successSoft, fg: colors.success, icon: 'check-circle' as const },
    warning: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-triangle' as const },
  }[tone];

  return (
    <Animated.View
      entering={FadeIn.duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      style={[styles.banner, { backgroundColor: config.bg }, style]}
      accessibilityRole="alert"
    >
      <Feather name={config.icon} size={16} color={config.fg} />
      <Text style={[styles.bannerText, { color: config.fg }]}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
          <Feather name="x" size={16} color={config.fg} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: colors.border },
  skeletonList: { gap: spacing.md },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.base,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  skeletonBody: { flex: 1, gap: 2 },

  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  stateCompact: { paddingVertical: spacing.xl },
  stateIconError: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stateIconNeutral: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stateTitle: { ...typography.subtitle, textAlign: 'center' },
  stateMessage: { ...typography.bodySmall, textAlign: 'center', maxWidth: 320 },
  stateAction: { marginTop: spacing.md },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  bannerText: { ...typography.bodySmall, flex: 1, fontWeight: '500' },
});
