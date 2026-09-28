/**
 * Design tokens.
 *
 * These values were read off app.padosipro.com's shipped stylesheet, so the
 * replica reads as the same product rather than a lookalike: the deep green
 * primary, the warm off-white canvas, the muted gold accent and the very
 * generous radii. Only the font stack is ours — the site's display face
 * (Eina01) and mono face (Space Mono) are licensed assets we cannot ship, so
 * the display face falls back to the platform serif and the mono face to the
 * system monospace, which land in a similar place.
 */

export const colors = {
  /** Brand green. Buttons, active states, key numerals. */
  primary: '#155C49',
  primaryDark: '#0F4436',
  primaryPressed: '#12483A',
  /** Secondary teal, used for accents and secondary highlights. */
  teal: '#009688',
  /** Mint tint for chips, selected cards and soft fills. */
  mint: '#4CC4A2',
  mintSoft: '#E8F8F3',

  /** Warm off-white canvas — the app has never been pure white. */
  background: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F4F7',

  textPrimary: '#101828',
  textSecondary: '#667085',
  textTertiary: '#98A2B3',
  textInverse: '#FFFFFF',

  border: '#E4E7EC',
  borderStrong: '#D0D5DD',

  /** Gold accent, used sparingly for emphasis. */
  accent: '#C9A84C',

  error: '#B42318',
  errorSoft: '#FEF3F2',
  success: '#027A48',
  successSoft: '#ECFDF3',
  warning: '#B54708',
  warningSoft: '#FDF6E3',

  /** Gradient stops for the hero header. */
  heroFrom: '#155C49',
  heroTo: '#009688',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const typography = {
  /** Display face: the wordmark and big screen titles. */
  display: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  /** Heading for a grouped block, e.g. one category in the selection list. */
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400' as const,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  /** All-caps eyebrow used above every screen title. */
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700' as const,
    color: colors.primary,
    letterSpacing: 2,
  },
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  /** Codes, counters and anything that should not reflow as digits change. */
  mono: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    fontFamily: undefined as string | undefined,
  },
} as const;

/** Shadow presets, tuned per platform because Android elevation is coarser. */
export const shadows = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

/**
 * The site's design leans on motion as much as colour. These easings are shared
 * by every animated component so the whole app accelerates the same way.
 */
export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
  springy: { damping: 14, stiffness: 180, mass: 0.7 },
  gentle: { damping: 18, stiffness: 120, mass: 0.8 },
} as const;

/** Height of the sticky bottom bar that holds the primary action. */
export const ACTION_BAR_HEIGHT = 92;

export const layout = {
  screenPadding: spacing.lg,
  maxContentWidth: 560,
} as const;
