import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { memo, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Layout,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { Task } from '../api/types';
import { colors, motion, radii, shadows, spacing, typography } from '../theme';

interface Props {
  task: Task;
  selected: boolean;
  onToggle: (taskId: number) => void;
  index?: number;
}

/**
 * A selectable task row.
 *
 * The checkbox is the part worth animating carefully: it fills and pops on
 * select, and the row itself lifts a hair and tints so a user scrolling a long
 * list can see at a glance what they have already picked. `memo` matters here —
 * this renders inside a list of a hundred rows and re-rendering all of them on
 * every toggle is the difference between smooth and visibly janky.
 */
export const TaskRow = memo(function TaskRow({ task, selected, onToggle, index = 0 }: Props) {
  const progress = useSharedValue(selected ? 1 : 0);
  const lift = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, { damping: 13, stiffness: 220, mass: 0.6 });
  }, [progress, selected]);

  const checkboxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolate(progress.value, [0, 1], [0, 1]) > 0.5 ? colors.primary : colors.surface,
    borderColor: interpolate(progress.value, [0, 1], [0, 1]) > 0.5 ? colors.primary : colors.borderStrong,
    transform: [{ scale: 0.9 + 0.1 * progress.value }],
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.4 + 0.6 * progress.value }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * lift.value }],
  }));

  const handlePress = () => {
    lift.value = withTiming(1, { duration: 110 });
    setTimeout(() => {
      lift.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    }, 110);
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    onToggle(task.id);
  };

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 10) * 28).duration(motion.base)}
      layout={Layout.springify().damping(20).stiffness(220)}
      style={rowStyle}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={task.name}
        accessibilityHint={task.description}
        style={[styles.row, selected && styles.rowSelected]}
      >
        <Animated.View style={[styles.checkbox, checkboxStyle]}>
          <Animated.View style={tickStyle}>
            <Feather name="check" size={13} color={colors.textInverse} />
          </Animated.View>
        </Animated.View>

        <View style={styles.body}>
          <Text style={[styles.name, selected && styles.nameSelected]}>{task.name}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {task.description}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

/** Compact row used on the Home screen, where the selection is read-only. */
export const SelectedTaskRow = memo(function SelectedTaskRow({
  name,
  categoryTitle,
  description,
  index = 0,
}: {
  name: string;
  categoryTitle: string;
  description: string;
  index?: number;
}) {
  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index, 12) * 45).duration(motion.base)}
      exiting={FadeOut.duration(motion.fast)}
      layout={Layout.springify().damping(20)}
      style={styles.selectedRow}
    >
      <View style={styles.selectedTick}>
        <Feather name="check" size={13} color={colors.textInverse} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.categoryTag}>{categoryTitle}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.mintSoft, ...shadows.card },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: { flex: 1, gap: 3 },
  name: { ...typography.subtitle, fontSize: 15, lineHeight: 21 },
  nameSelected: { color: colors.primaryDark },
  description: { ...typography.bodySmall, fontSize: 13 },

  selectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  selectedTick: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  categoryTag: { ...typography.label, color: colors.primary, fontSize: 11, letterSpacing: 0.8 },
});
