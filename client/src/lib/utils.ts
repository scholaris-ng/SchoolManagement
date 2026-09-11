import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes so later utilities reliably win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/** `ACTION_TAKEN` -> `Action taken` for enum values shown in the UI. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyOf: (item: T) => K,
): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const key = keyOf(item);
      (acc[key] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

/** Deterministic colour for avatars/labels so the same name always matches. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 45%)`;
}

function srgbChannelLuminance(value255: number): number {
  const c = value255 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance from 0-255 channels. */
function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelLuminance(r) +
    0.7152 * srgbChannelLuminance(g) +
    0.0722 * srgbChannelLuminance(b)
  );
}

/** `hsl(h s% l%)`, as `colorFromString` emits it, as 0-255 RGB. */
function hslStringToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

/** Parses `#rrggbb` or `hsl(h s% l%)`; falls back to mid-grey on anything else. */
function toRgb(color: string): [number, number, number] {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const hsl = color.trim().match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (hsl) return hslStringToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));
  return [148, 148, 148];
}

const WHITE_LUMINANCE = 1;
// The app's own near-black (`222 47% 8%` in `styles/index.css`), not pure
// `#000` — keeps a colour swatch's dark text matching the rest of the app.
const DARK_TEXT_LUMINANCE = relativeLuminance(11, 17, 30);

function contrastRatio(l1: number, l2: number): number {
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * White or the app's near-black, whichever reads better on `color`.
 *
 * For text sitting directly on a colour swatch — an avatar initial, a
 * school's own brand mark — the swatch decides the contrast, not the
 * surrounding light/dark theme. `color` can be a hash-generated hue
 * (`colorFromString`) or a school's own picked brand colour, and either can
 * land anywhere on the lightness scale: a pale gold or lime swatch drops
 * white text to roughly 2:1, well under WCAG's 4.5:1 floor. Always pick
 * whichever of the two options actually passes rather than assuming white.
 */
export function contrastingTextColor(color: string): string {
  const [r, g, b] = toRgb(color);
  const backgroundLuminance = relativeLuminance(r, g, b);
  const withWhite = contrastRatio(backgroundLuminance, WHITE_LUMINANCE);
  const withDark = contrastRatio(backgroundLuminance, DARK_TEXT_LUMINANCE);
  return withWhite >= withDark ? '#ffffff' : '#0b111e';
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => timer && clearTimeout(timer);
  return debounced;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
