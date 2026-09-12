import { useEffect, useRef, useState } from 'react';
import {
  Award,
  Bed,
  BookOpen,
  Bus,
  Church,
  ClipboardCheck,
  Compass,
  Cpu,
  Droplet,
  FlaskConical,
  Globe,
  Handshake,
  Heart,
  Laptop,
  Library,
  Megaphone,
  Monitor,
  Music,
  Palette,
  School,
  Shield,
  Shirt,
  Sparkles,
  Stethoscope,
  Target,
  Trees,
  Trophy,
  UtensilsCrossed,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteIconName, SiteImage as SiteImageData } from '../site-content';

/**
 * The public site's shared building blocks.
 *
 * Content carries icons as string keys so the whole content model stays plain
 * JSON and can come back from the API untouched; the mapping from key to
 * component lives here, where the components actually are.
 */
const ICONS: Record<SiteIconName, LucideIcon> = {
  award: Award,
  bed: Bed,
  book: BookOpen,
  bus: Bus,
  church: Church,
  clipboard: ClipboardCheck,
  compass: Compass,
  cpu: Cpu,
  droplet: Droplet,
  flask: FlaskConical,
  globe: Globe,
  handshake: Handshake,
  heart: Heart,
  laptop: Laptop,
  library: Library,
  megaphone: Megaphone,
  monitor: Monitor,
  music: Music,
  palette: Palette,
  school: School,
  shield: Shield,
  shirt: Shirt,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
  target: Target,
  trees: Trees,
  trophy: Trophy,
  users: Users,
  utensils: UtensilsCrossed,
};

export function SiteIcon({ name, className }: { name: SiteIconName; className?: string }) {
  const Component = ICONS[name] ?? Sparkles;
  return <Component className={className} aria-hidden="true" />;
}

/* -- Layout ---------------------------------------------------------------- */

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1180px] px-5 sm:px-8', className)}>{children}</div>;
}

interface SectionProps {
  id?: string;
  /** `canvas` tints the background, `band` is the dark brand block. */
  tone?: 'surface' | 'canvas' | 'band';
  className?: string;
  children: React.ReactNode;
}

export function Section({ id, tone = 'surface', className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-20 lg:py-24',
        tone === 'canvas' && 'bg-[var(--site-canvas)]',
        tone === 'band' && 'site-band text-white',
        className,
      )}
      style={tone === 'surface' ? { backgroundColor: 'var(--site-surface)' } : undefined}
    >
      {children}
    </section>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: 'left' | 'center';
  onDark?: boolean;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'left',
  onDark = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        <p className={cn('site-eyebrow', onDark && 'site-eyebrow--light', align === 'center' && 'justify-center')}>
          {eyebrow}
        </p>
      )}
      <h2
        className={cn('mt-4 text-[1.75rem] sm:text-[2.125rem] lg:text-[2.5rem]', onDark && 'text-white')}
        style={onDark ? { color: '#fff' } : undefined}
      >
        {title}
      </h2>
      {lede && (
        <p className={cn('site-lede mt-4', onDark && 'text-white/75')}>{lede}</p>
      )}
    </div>
  );
}

/* -- Media ----------------------------------------------------------------- */

interface SiteImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading'> {
  image: SiteImageData;
  className?: string;
  /** Above-the-fold images skip lazy loading so the hero paints immediately. */
  eager?: boolean;
}

/**
 * An image that degrades to a brand-tinted block rather than a broken icon —
 * schools replace these photographs constantly, and a missing file should never
 * put a torn page in front of a prospective parent.
 */
export function SiteImage({ image, className, eager = false, ...rest }: SiteImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn('bg-[var(--site-brand-soft)]', className)}
        role="img"
        aria-label={image.alt}
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      />
    );
  }

  return (
    <img
      src={image.src}
      alt={image.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}

/* -- Motion ---------------------------------------------------------------- */

/**
 * Fades a block in the first time it scrolls into view. Purely decorative: the
 * content is in the DOM and visible to assistive technology from the start, and
 * the CSS honours `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className, shown && 'site-fade-in')}
      style={shown && delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
