import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { router } from '@/app/router';
import { AuthProvider } from '@/app/providers/auth-provider';
import { ThemeProvider } from '@/app/providers/theme-provider';
import { Toaster, TooltipProvider } from '@/components/ui/feedback';
import { FullPageLoader } from '@/components/layout/full-page-loader';
import '@/styles/index.css';

const queryClient = createQueryClient();

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

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
