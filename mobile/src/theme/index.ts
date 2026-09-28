import { Platform, TextStyle } from 'react-native';
import { colors, radii, spacing, typography } from './tokens';

export * from './tokens';

/**
 * The display face. Eina01 is a licensed asset so it cannot be shipped here;
 * the platform serif sits in a similar place optically and keeps the wordmark
 * feeling considered rather than default.
 */
export const displayFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

/** Shared text styles that do not belong to the type scale above. */
export const textStyles = {
  wordmark: {
    fontFamily: displayFont,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700' as const,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  screenTitle: {
    fontFamily: displayFont,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  mono: {
    fontFamily: monoFont,
    color: colors.textPrimary,
  } as TextStyle,
} as const;

export const shared = {
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
} as const;
