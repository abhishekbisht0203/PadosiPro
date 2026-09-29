import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import type { SelectedTask } from '../api/types';
import { Badge, FloatingOrb, StaggeredList } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { SelectedTaskRow } from '../components/TaskRow';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shared, shadows, spacing, typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { describeError } from '../utils/errors';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home.
 *
 * Deliberately simple, per the brief: it lists the tasks the user selected and
 * gives them a way out (edit the selection, log out). Grouping by category is
 * what makes a list of a hundred tasks scannable.
 */
export function HomeScreen() {
  const { token, profile, email, logout, beginEditSelection, reportSelectedTaskCount } = useAuth();
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<SelectedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) return;
      if (mode === 'initial') setLoading(true);
      setError(null);

      try {
        const { tasks: loaded, totalSelected } = await api.selectedTasks(token);
        setTasks(loaded);
        // Report, do not route. Driving the stage from here made the empty
        // state below unreachable: fetching 0 switched the stage to `tasks` and
        // unmounted Home before "No tasks selected yet" could render.
        reportSelectedTaskCount(totalSelected);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [reportSelectedTaskCount, token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load('refresh');
  }, [load]);

  const confirmLogout = useCallback(() => {
    const run = () => void logout();

    if (Platform.OS === 'web') {
      run();
      return;
    }

    Alert.alert('Log out', 'You will need to sign in again to see your tasks.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: run },
    ]);
  }, [logout]);

  /**
   * Enter the picker without touching the saved selection.
   *
   * This used to call `PUT /api/tasks/selected` with an empty array and then
   * let the resulting count of 0 route the user to the picker. That genuinely
   * deleted every saved task the moment they tapped "edit" — so backing out,
   * losing connection, or having the app killed meant the selection was gone.
   * Now nothing is written until the user explicitly confirms.
   */
  const editSelection = useCallback(async () => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    beginEditSelection();
  }, [beginEditSelection]);

  const firstName = (profile?.name ?? '').split(' ')[0] || 'there';
  const initials = (profile?.name ?? 'PP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const grouped = tasks.reduce<Record<string, SelectedTask[]>>((acc, task) => {
    (acc[task.categoryTitle] ??= []).push(task);
    return acc;
  }, {});

  return (
    <View style={shared.screen}>
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
      >
        <FloatingOrb size={170} color="rgba(255,255,255,0.07)" style={{ top: -60, right: -30 }} />
        <FloatingOrb size={110} color="rgba(255,255,255,0.05)" offset={800} style={{ bottom: -30, left: -20 }} />

        <StaggeredList index={0} base={40}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>{greeting()}</Text>
              <Text style={styles.heroTitle}>Hi, {firstName}</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'PP'}</Text>
            </View>
          </View>
        </StaggeredList>

        <StaggeredList index={1} base={40}>
          <Text style={styles.heroSubtitle}>
            Your Lifestyle Manager has these {tasks.length === 1 ? 'task' : 'tasks'} covered.
          </Text>
        </StaggeredList>

        <StaggeredList index={2} base={40}>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{tasks.length}</Text>
              <Text style={styles.heroStatLabel}>Tasks</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{Object.keys(grouped).length}</Text>
              <Text style={styles.heroStatLabel}>Categories</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>1</Text>
              <Text style={styles.heroStatLabel}>Manager</Text>
            </View>
          </View>
        </StaggeredList>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.toolbar}>
          <Text style={styles.toolbarTitle}>Your tasks</Text>
          <View style={styles.toolbarActions}>
            <Pressable onPress={editSelection} hitSlop={8} accessibilityRole="button" style={styles.iconButton}>
              <Feather name="edit-3" size={16} color={colors.primary} />
            </Pressable>
            <Pressable onPress={confirmLogout} hitSlop={8} accessibilityRole="button" style={styles.iconButton}>
              <Feather name="log-out" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {error ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <ErrorState
              title="Could not load your tasks"
              message={error}
              onRetry={() => void load()}
              compact
            />
          </Animated.View>
        ) : loading ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={22} height={22} borderRadius={7} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="65%" height={13} />
                  <Skeleton width="90%" height={11} />
                </View>
              </View>
            ))}
          </View>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="list"
            title="No tasks selected yet"
            message="Pick the tasks you would like handled and they will show up here."
            actionLabel="Choose tasks"
            onAction={editSelection}
          />
        ) : (
          Object.entries(grouped).map(([categoryTitle, categoryTasks]) => (
            <View key={categoryTitle} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{categoryTitle}</Text>
                <Badge label={`${categoryTasks.length}`} tone="primary" />
              </View>
              <View style={styles.groupBody}>
                {categoryTasks.map((task, index) => (
                  <SelectedTaskRow
                    key={task.id}
                    name={task.name}
                    categoryTitle={task.subcategory}
                    description={task.description}
                    index={index}
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {profile ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Feather name="user" size={15} color={colors.primary} />
              <Text style={styles.profileHeaderText}>Your details</Text>
            </View>
            <DetailRow icon="user" label="Name" value={profile.name} />
            <DetailRow icon="phone" label="Mobile" value={`+91 ${profile.mobile}`} />
            <DetailRow icon="map-pin" label="Address" value={profile.address} />
            {profile.businessName ? (
              <DetailRow icon="briefcase" label="Business" value={profile.businessName} />
            ) : null}
            {email ? <DetailRow icon="mail" label="Email" value={email} /> : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <PrimaryButton
            label="Log out"
            onPress={confirmLogout}
            variant="secondary"
            icon="log-out"
            testID="logout-button"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={13} color={colors.textTertiary} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCopy: { flex: 1 },
  heroEyebrow: { ...typography.label, color: 'rgba(255,255,255,0.78)' },
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: colors.textInverse, marginTop: 2 },
  heroSubtitle: { ...typography.bodySmall, color: 'rgba(255,255,255,0.86)', marginTop: spacing.sm },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.textInverse },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  heroStatDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.24)' },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  toolbarTitle: { ...typography.title, fontSize: 19 },
  toolbarActions: { flexDirection: 'row', gap: spacing.sm },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonWrap: { gap: spacing.md },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },

  group: { marginTop: spacing.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  groupTitle: { ...typography.sectionTitle, fontSize: 16 },
  groupBody: { gap: spacing.md },

  profileCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: spacing.sm,
    ...shadows.card,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  profileHeaderText: { ...typography.subtitle, fontSize: 15 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  detailLabel: { ...typography.bodySmall, width: 58 },
  detailValue: { ...typography.bodySmall, flex: 1, color: colors.textPrimary, fontWeight: '500' },

  footer: { marginTop: spacing.xl },
});
