import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import type { TaskCategory } from '../api/types';
import { HeroHeader } from '../components/HeroHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SearchField } from '../components/TextField';
import { EmptyState, ErrorState, TaskListSkeleton } from '../components/States';
import { TaskRow } from '../components/TaskRow';
import { useAuth } from '../context/AuthContext';
import { ACTION_BAR_HEIGHT, colors, motion, radii, shared, shadows, spacing, typography } from '../theme';
import { describeError } from '../utils/errors';

interface FlatTask {
  id: number;
  name: string;
  description: string;
  categoryId: string;
}

/**
 * Task selection.
 *
 * Tasks are grouped by category, searchable across every field the user might
 * reasonably type, and multi-select. The confirm step is inline rather than a
 * separate screen: the sticky bar keeps the running count and the primary
 * action visible while they scroll, so there is no dead end and no way to get
 * stuck on a second screen with a stale list.
 */
export function TaskSelectionScreen() {
  const { token, setSelectedTaskCount } = useAuth();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const listRef = useRef<SectionList<FlatTask>>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const { categories: loaded } = await api.tasks(token);
      setCategories(loaded);
      setSelected(new Set(loaded.flatMap((c) => c.tasks.filter((t) => t.selected).map((t) => t.id))));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback((taskId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    setSaveError(null);
  }, []);

  /**
   * Search runs across task name, description and category title. Matches on
   * any word rather than the whole phrase, so "home ac" finds "AC servicing &
   * installation" under Home Services.
   */
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return categories
        .map((c) => ({ ...c, tasks: c.tasks.map((t) => ({ ...t, categoryId: c.id })) }))
        .filter((c) => c.tasks.length > 0);
    }

    return categories
      .map((c) => ({
        ...c,
        tasks: c.tasks
          .map((t) => ({ ...t, categoryId: c.id }))
          .filter((t) => {
            const haystack = `${t.name} ${t.description} ${c.title} ${c.subtitle}`.toLowerCase();
            return terms.every((term) => haystack.includes(term));
          }),
      }))
      .filter((c) => c.tasks.length > 0);
  }, [categories, query]);

  const totalMatching = filtered.reduce((sum, c) => sum + c.tasks.length, 0);

  const toggleCategory = useCallback(
    (categoryId: string, tasks: FlatTask[]) => {
      const allSelected = tasks.every((t) => selected.has(t.id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const task of tasks) {
          if (allSelected) next.delete(task.id);
          else next.add(task.id);
        }
        return next;
      });
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    },
    [selected],
  );

  const confirm = useCallback(async () => {
    if (!token || selected.size === 0) return;
    setSaving(true);
    setSaveError(null);

    try {
      const { totalSelected } = await api.saveSelectedTasks(token, [...selected]);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSelectedTaskCount(totalSelected);
    } catch (err) {
      setSaveError(describeError(err));
    } finally {
      setSaving(false);
    }
  }, [selected, selected.size, setSelectedTaskCount, token]);

  return (
    <View style={shared.screen}>
      <HeroHeader
        eyebrow="Step 2 of 2"
        title="What should we handle?"
        subtitle="Pick everything you would rather not think about. You can change this any time."
        compact
      />

      {loading ? (
        <View style={[shared.content, styles.loadingWrap]}>
          <TaskListSkeleton rows={6} />
        </View>
      ) : error ? (
        <View style={[shared.content, styles.loadingWrap]}>
          <ErrorState title="Could not load tasks" message={error} onRetry={load} />
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + ACTION_BAR_HEIGHT + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          layout={LinearTransition.duration(motion.base)}
          ListHeaderComponent={
            <View style={styles.header}>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search tasks, e.g. cleaning, AC, bills"
                onClear={() => setQuery('')}
              />
              {query.trim().length > 0 ? (
                <Text style={styles.matchCount}>
                  {totalMatching} {totalMatching === 1 ? 'task' : 'tasks'} matching
                </Text>
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => {
            const allSelected = section.tasks.length > 0 && section.tasks.every((t) => selected.has(t.id));
            const someSelected = section.tasks.some((t) => selected.has(t.id));
            return (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrap}>
                  <View style={styles.sectionIcon}>
                    <Feather name={section.icon as never} size={16} color={colors.primary} />
                  </View>
                  <View style={styles.sectionTitleText}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionSubtitle} numberOfLines={1}>
                      {section.subtitle}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => toggleCategory(section.id, section.tasks)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${allSelected ? 'Deselect' : 'Select all'} in ${section.title}`}
                >
                  <View style={[styles.selectAllPill, allSelected && styles.selectAllPillActive]}>
                    <Text style={[styles.selectAllText, allSelected && styles.selectAllTextActive]}>
                      {allSelected ? 'Clear' : 'All'}
                    </Text>
                  </View>
                </Pressable>
                {someSelected && !allSelected ? <View style={styles.partialMarker} /> : null}
              </View>
            );
          }}
          renderItem={({ item, index }) => (
            <View style={styles.rowWrap}>
              <TaskRow task={item} selected={selected.has(item.id)} onToggle={toggle} index={index} />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="Nothing matched that search"
              message={
                categories.length === 0
                  ? 'The task catalogue is empty right now. Please try again shortly.'
                  : 'Try a different word — or clear the search to see everything.'
              }
              actionLabel={query ? 'Clear search' : undefined}
              onAction={() => setQuery('')}
              compact
            />
          }
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={11}
        />
      )}

      {/* Sticky action bar: always visible, so there is no dead end. */}
      {!loading && !error ? (
        <SelectionBar
          count={selected.size}
          saving={saving}
          error={saveError}
          bottomInset={insets.bottom}
          onConfirm={confirm}
        />
      ) : null}
    </View>
  );
}

/** The sticky bottom bar with the running count and the confirm action. */
function SelectionBar({
  count,
  saving,
  error,
  bottomInset,
  onConfirm,
}: {
  count: number;
  saving: boolean;
  error: string | null;
  bottomInset: number;
  onConfirm: () => void;
}) {
  const bar = useSharedValue(0);

  useEffect(() => {
    bar.value = withTiming(count > 0 ? 1 : 0, { duration: motion.base });
  }, [bar, count]);

  const barStyle = useAnimatedStyle(() => ({
    opacity: bar.value,
    transform: [{ translateY: (1 - bar.value) * 24 }],
  }));

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (saving) {
      pulse.value = withSpring(1, motion.springy);
    } else {
      pulse.value = withTiming(0, { duration: motion.fast });
    }
  }, [pulse, saving]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { paddingBottom: Math.max(bottomInset, spacing.md) },
        barStyle,
        shadows.raised,
      ]}
    >
      {error ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.barError}>
          <Feather name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.barErrorText}>{error}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.barInner}>
        <View style={styles.countWrap}>
          <Text style={styles.count}>{count}</Text>
          <Text style={styles.countLabel}>{count === 1 ? 'task selected' : 'tasks selected'}</Text>
        </View>

        <Animated.View style={[{ flex: 1 }, buttonStyle]}>
          <PrimaryButton
            label="Confirm selection"
            onPress={onConfirm}
            loading={saving}
            disabled={count === 0}
            icon="arrow-right"
            testID="confirm-selection"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { paddingTop: spacing.lg },
  header: { gap: spacing.xs, paddingBottom: spacing.sm },
  matchCount: { ...typography.bodySmall, fontSize: 12, paddingLeft: spacing.xs },
  rowWrap: { paddingBottom: spacing.md },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleText: { flex: 1 },
  sectionTitle: { ...typography.sectionTitle, fontSize: 16 },
  sectionSubtitle: { ...typography.bodySmall, fontSize: 12 },
  selectAllPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectAllPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectAllText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  selectAllTextActive: { color: colors.textInverse },
  partialMarker: {
    position: 'absolute',
    right: spacing.md,
    bottom: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  countWrap: { minWidth: 74 },
  count: { fontSize: 24, lineHeight: 28, fontWeight: '700', color: colors.primary },
  countLabel: { ...typography.bodySmall, fontSize: 11 },
  barError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  barErrorText: { ...typography.bodySmall, color: colors.error, flex: 1, fontSize: 12 },
});
