import { describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesGuard } from './form-actions';

/**
 * The guard used to hand this question to `window.confirm`, which blocks the
 * thread, ignores the product's styling and cannot be driven by a test. What
 * matters now is that leaving a dirty form asks in the app's own dialog, that
 * declining really does keep the typing on screen, and that accepting lets the
 * navigation through.
 */
function renderGuarded({ dirty = true }: { dirty?: boolean } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/students/new',
        element: (
          <>
            <UnsavedChangesGuard when={dirty} />
            <h1>Admission form</h1>
            <Link to="/students">Back to students</Link>
          </>
        ),
      },
      { path: '/students', element: <h1>Student register</h1> },
    ],
    { initialEntries: ['/students/new'] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

describe('UnsavedChangesGuard', () => {
  it('asks in the app dialog rather than a native browser prompt', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    renderGuarded();

    await user.click(screen.getByRole('link', { name: 'Back to students' }));

    expect(await screen.findByText('Leave without saving?')).toBeInTheDocument();
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('keeps the user on the form when they choose to stay', async () => {
    const user = userEvent.setup();
    const { router } = renderGuarded();

    await user.click(screen.getByRole('link', { name: 'Back to students' }));
    await user.click(await screen.findByRole('button', { name: 'Stay on page' }));

    await waitFor(() => {
      expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe('/students/new');
    expect(screen.getByRole('heading', { name: 'Admission form' })).toBeInTheDocument();
  });

  it('lets the navigation through once the user accepts the loss', async () => {
    const user = userEvent.setup();
    const { router } = renderGuarded();

    await user.click(screen.getByRole('link', { name: 'Back to students' }));
    await user.click(await screen.findByRole('button', { name: 'Leave page' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/students');
    });
    expect(await screen.findByRole('heading', { name: 'Student register' })).toBeInTheDocument();
  });

  it('registers no beforeunload handler, which only the browser can draw', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    renderGuarded();

    expect(addListener.mock.calls.map(([type]) => type)).not.toContain('beforeunload');
    addListener.mockRestore();
  });

  it('does not interrupt navigation when the form is clean', async () => {
    const user = userEvent.setup();
    const { router } = renderGuarded({ dirty: false });

    await user.click(screen.getByRole('link', { name: 'Back to students' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/students');
    });
    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument();
  });
});
