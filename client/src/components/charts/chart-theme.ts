/**
 * Shared chart configuration.
 *
 * Charts read their colours from the same CSS variables as everything else, so
 * they follow the school's brand colour and the light/dark theme without any
 * per-chart configuration.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : fallback;
}

export const chartTheme = {
  get colors(): string[] {
    return [
      cssVar('--primary', 'hsl(243 75% 59%)'),
      cssVar('--info', 'hsl(199 89% 42%)'),
      cssVar('--success', 'hsl(142 71% 35%)'),
      cssVar('--warning', 'hsl(32 95% 44%)'),
      cssVar('--danger', 'hsl(0 72% 51%)'),
      'hsl(280 65% 55%)',
      'hsl(160 60% 40%)',
      'hsl(20 80% 55%)',
    ];
  },
  get grid(): string {
    return cssVar('--border', 'hsl(214 32% 91%)');
  },
  get axis() {
    const muted = cssVar('--muted-foreground', 'hsl(215 16% 47%)');
    return {
      stroke: muted,
      tick: { fill: muted, fontSize: 11 },
      tickLine: false,
      axisLine: false,
    };
  },
  get tooltip() {
    return {
      contentStyle: {
        background: cssVar('--popover', '#fff'),
        border: `1px solid ${cssVar('--border', '#e2e8f0')}`,
        borderRadius: 8,
        fontSize: 12,
        color: cssVar('--popover-foreground', '#0f172a'),
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
      },
      labelStyle: { fontWeight: 600, marginBottom: 4 },
      cursor: { fill: cssVar('--muted', '#f1f5f9'), fillOpacity: 0.5 },
    };
  },
} as const;

/** Grade letters get a consistent colour wherever they appear. */
export function gradeColor(grade: string): string {
  const first = grade.charAt(0).toUpperCase();
  const map: Record<string, string> = {
    A: 'hsl(142 71% 35%)',
    B: 'hsl(160 60% 40%)',
    C: 'hsl(199 89% 42%)',
    D: 'hsl(32 95% 44%)',
    E: 'hsl(20 80% 55%)',
    F: 'hsl(0 72% 51%)',
  };
  return map[first] ?? 'hsl(215 16% 47%)';
}
