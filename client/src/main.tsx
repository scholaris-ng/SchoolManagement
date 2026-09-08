import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { env } from '@/lib/env';
import { createQueryClient } from '@/lib/query-client';
import { router } from '@/app/router';
import { AuthProvider } from '@/app/providers/auth-provider';
import { ThemeProvider } from '@/app/providers/theme-provider';
import { Toaster, TooltipProvider } from '@/components/ui/feedback';
import { FullPageLoader } from '@/components/layout/full-page-loader';
import '@/styles/index.css';

const queryClient = createQueryClient();

/**
 * Whether the mock bundle exists in this build at all.
 *
 * Both operands are substituted at build time, so an ordinary production build
 * folds this to `false` and Rollup eliminates the dynamic import below —
 * handlers, seeded student names and MSW itself never reach `dist/`. A demo
 * build (`VITE_DEMO_MODE=true`) opts in and keeps them.
 */
const MOCKS_COMPILED_IN = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * The mock API is started *before* React mounts so the very first query is
 * intercepted rather than racing the worker registration.
 */
async function enableMocking(): Promise<void> {
  if (!MOCKS_COMPILED_IN || !env.useMockApi) return;
  try {
    const { startMockApi } = await import('@/mocks/browser');
    await startMockApi();
  } catch (cause) {
    // Some environments refuse service-worker registration (sandboxed frames,
    // private modes, an origin served over plain HTTP). Mount anyway: an app
    // whose requests fail loudly is far easier to diagnose than a blank page.
    console.error(
      '[mock-api] The mock API could not start; requests will go to the real API instead.',
      cause,
    );
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <Suspense fallback={<FullPageLoader />}>
              <RouterProvider router={router} />
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

void enableMocking().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
