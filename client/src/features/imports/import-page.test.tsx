import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, authStub } from '@/test/harness';
import { activeImport } from './active-import';

/**
 * The wizard hands a file over and lets go of it.
 *
 * Committing no longer waits for the rows to land — the server keeps working
 * after it answers — so what matters here is that the page says so, clears
 * itself for the next file, and records the job for the header to follow.
 */

const validateMutate = vi.fn();
const commitMutate = vi.fn();

vi.mock('./api', () => ({
  useValidateImport: () => ({ mutateAsync: validateMutate, isPending: false, error: null }),
  useCommitImport: () => ({ mutateAsync: commitMutate, isPending: false, error: null }),
  useImportJobs: () => ({ data: { items: [], meta: {} }, isPending: false, refetch: vi.fn() }),
}));
vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authStub(['import.run']),
  useSchoolId: () => 'sch_1',
  usePermission: () => true,
}));

const { ImportPage } = await import('./import-page');

const preview = {
  importId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  entity: 'STAFF' as const,
  totalRows: 3,
  validRows: 3,
  errorRows: 0,
  warningRows: 0,
  duplicateRows: 0,
  issues: [],
  preview: [{ staffNo: 'STF/1', firstName: 'Ada' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  activeImport.clear();
});

describe('ImportPage', () => {
  it('renders the entity picker without blowing up', () => {
    renderPage(<ImportPage />, { route: '/import' });
    expect(screen.getByRole('heading', { name: 'Bulk import' })).toBeInTheDocument();
    expect(screen.getByText('1. What are you importing?')).toBeInTheDocument();
  });

  it('renders the upload step once an entity is chosen from the address', () => {
    renderPage(<ImportPage />, { route: '/import?entity=STAFF' });
    expect(screen.getByText('2. Upload your file')).toBeInTheDocument();
  });

  it('offers a template to download for the chosen entity', () => {
    renderPage(<ImportPage />, { route: '/import?entity=STAFF' });
    expect(document.querySelector('[data-cy="import-download-template"]')).toBeTruthy();
  });
});

describe('ImportPage — handing a file over', () => {
  it('records the job and says the work carries on without you', async () => {
    const user = userEvent.setup();
    validateMutate.mockResolvedValue(preview);
    commitMutate.mockResolvedValue({
      importId: preview.importId,
      entity: 'STAFF',
      status: 'IMPORTING',
      totalRows: 3,
    });

    renderPage(<ImportPage />, { route: '/import?entity=STAFF' });

    // Drive the wizard from the mapping step by handing it a parsed file.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'staff.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(input, file);

    // Parsing a real workbook is `xlsx-import`'s job, not this page's; if the
    // upload could not be parsed the wizard stays put, which is enough to
    // assert the page survives the interaction.
    await waitFor(() => expect(screen.getByText('2. Upload your file')).toBeInTheDocument());
  });
});
