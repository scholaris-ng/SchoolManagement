import { DEMO_PERSONAS } from '@/mocks/personas';
import { Card, CardContent } from '@/components/ui/primitives';

/**
 * The development sign-in shortcuts.
 *
 * Kept in its own lazily-imported module so the seeded persona list — real-looking
 * names attached to a fictional school — is compiled out of production bundles
 * entirely rather than merely hidden behind a runtime flag.
 */
export function DevPersonaPanel({ onSignInAs }: { onSignInAs: (email: string) => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 pt-5">
        <div>
          <p className="text-sm font-medium">Development personas</p>
          <p className="text-xs text-muted-foreground">
            Mock authentication is on. Sign in as any role to explore the app.
          </p>
        </div>
        <div className="grid gap-1.5">
          {DEMO_PERSONAS.map((persona) => (
            <button
              data-cy="auth-dev-personas-sign-in"
              key={persona.email}
              type="button"
              onClick={() => onSignInAs(persona.email)}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{persona.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {persona.roleLabel}
                </span>
              </span>
              <span className="shrink-0 text-xs text-primary">Sign in</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default DevPersonaPanel;
