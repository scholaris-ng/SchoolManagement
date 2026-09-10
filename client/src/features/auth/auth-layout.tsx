import { GraduationCap } from 'lucide-react';

/**
 * The split-screen shell every unauthenticated page shares.
 *
 * The brand panel is hidden below `lg`, where it would only push the form
 * under the fold on the phones most parents will use.
 */
export function AuthLayout({
  children,
  headline,
  blurb,
}: {
  children: React.ReactNode;
  headline?: string;
  blurb?: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold">Scholaris</span>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            {headline ?? 'One system for the whole school.'}
          </h1>
          <p className="text-primary-foreground/80">
            {blurb ??
              'Admissions, attendance, curriculum coverage, results, fees and parent communication — built for how schools actually run, and for the days the internet does not.'}
          </p>
        </div>

        <p className="text-xs text-primary-foreground/60">
          Children&apos;s data is handled with privacy-first defaults. Photographs are never
          published without recorded consent.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
