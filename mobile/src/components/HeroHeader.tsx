import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../theme';
import { displayFont, textStyles } from '../theme';
import { FloatingOrb, StaggeredList } from './Motion';

/**
 * The gradient header every screen opens with.
 *
 * On the real app the top of the screen is a deep green field with the wordmark
 * and a short line of copy sitting on it, so this is the single most
 * recognisable piece of the visual language. The floating orbs behind the copy
 * are what stop it reading as a flat rectangle.
 */
export function HeroHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  rightSlot,
  children,
  compact = false,
  style,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[colors.heroFrom, colors.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + spacing.sm }, compact && styles.heroCompact, style]}
    >
      <FloatingOrb size={180} color="rgba(255,255,255,0.07)" offset={0} style={{ top: -50, right: -40 }} />
      <FloatingOrb size={120} color="rgba(255,255,255,0.05)" offset={900} style={{ bottom: -40, left: -30 }} />

      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={20} color={colors.textInverse} />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <View style={styles.heroCentre}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        </View>

        {rightSlot ?? <View style={styles.backSpacer} />}
      </View>

      <StaggeredList index={0} base={90}>
        <Text style={[textStyles.screenTitle, styles.title]}>{title}</Text>
      </StaggeredList>

      {subtitle ? (
        <StaggeredList index={1} base={90}>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </StaggeredList>
      ) : null}

      {children}
    </LinearGradient>
  );
}

/**
 * The wordmark lockup, used on the welcome and sign-in screens where there is no
 * back navigation and the brand should carry the screen.
 */
export function Wordmark({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wordmarkRow, style]}>
      <View style={styles.wordmarkGlyph}>
        <Feather name="check" size={16} color={colors.textInverse} />
      </View>
      <Text style={textStyles.wordmark}>PadosiPro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radii.xxl,
    borderBottomRightRadius: radii.xxl,
    overflow: 'hidden',
  },
  heroCompact: { paddingBottom: spacing.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: { width: 38, height: 38 },
  heroCentre: { flex: 1, alignItems: 'center' },
  eyebrow: { ...typography.eyebrow, color: 'rgba(255,255,255,0.82)' },
  title: { color: colors.textInverse, fontSize: 25, lineHeight: 32 },
  subtitle: {
    ...typography.body,
    color: 'rgba(255,255,255,0.86)',
    marginTop: spacing.sm,
    maxWidth: 460,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wordmarkGlyph: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontFamily: displayFont },
});
