import { GraduationCap, Loader2 } from 'lucide-react';

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-4">
        <span className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-6" aria-hidden="true" />
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span role="status">{label}</span>
        </div>
      </div>
    </div>
  );
}
