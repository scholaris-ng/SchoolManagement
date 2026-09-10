import { CheckCircle2, Info, ShieldAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** An inline banner for something the user should notice but not be blocked by. */

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  'data-cy'?: string;
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
  icon,
  'data-cy': dataCy,
}: AlertProps) {
  const tones = {
    info: { wrapper: 'border-info/30 bg-info-subtle', text: 'text-info', Icon: Info },
    success: { wrapper: 'border-success/30 bg-success-subtle', text: 'text-success', Icon: CheckCircle2 },
    warning: { wrapper: 'border-warning/30 bg-warning-subtle', text: 'text-warning', Icon: TriangleAlert },
    danger: { wrapper: 'border-danger/30 bg-danger-subtle', text: 'text-danger', Icon: ShieldAlert },
  }[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      data-cy={dataCy}
      className={cn('flex items-start gap-3 rounded-lg border p-3.5', tones.wrapper, className)}
    >
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', tones.text)} aria-hidden="true">
        {icon ?? <tones.Icon />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium text-foreground">{title}</p>}
        {children && <div className={cn('text-muted-foreground', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
