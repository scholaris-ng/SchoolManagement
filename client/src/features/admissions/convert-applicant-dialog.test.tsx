import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AdmissionApplication } from '@/types/admissions';

const useConvertAdmission = vi.fn();

vi.mock('./api', () => ({
  useConvertAdmission: (...args: unknown[]) => useConvertAdmission(...args),
}));
vi.mock('@/features/academics/api', () => ({
  useClassOptions: () => [
    { value: 'cls_1', label: 'JSS 1 Gold' },
    { value: 'cls_2', label: 'Senior Secondary 1' },
  ],
}));

const { ConvertApplicantDialog } = await import('./convert-applicant-dialog');

/** Only `useNavigate` needs a router here — nothing else the dialog touches is real. */
function renderDialog(props: React.ComponentProps<typeof ConvertApplicantDialog>) {
  return render(
    <MemoryRouter>
      <ConvertApplicantDialog {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useConvertAdmission.mockReturnValue({ mutateAsync: vi.fn(), isPending: false, error: null });
});

function application(over: Partial<AdmissionApplication> = {}): AdmissionApplication {
  return {
    id: 'adm_1',
    schoolId: 'sch_1',
    applicationNo: 'APP-0001',
    sessionId: 'ses_1',
    sessionName: '2025/2026',
    levelId: 'lvl_1',
    levelName: 'Senior Secondary',
    desiredClassId: null,
    desiredClassName: null,
    applicantType: 'GUARDIAN',
    source: 'OFFICE',
    applicant: {
      firstName: 'Chidera',
      lastName: 'Okoro',
      gender: 'FEMALE',
      dateOfBirth: '2012-01-01',
    },
    contacts: [
      {
        firstName: 'Ngozi',
        lastName: 'Okoro',
        relationship: 'MOTHER',
        email: 'ngozi@example.com',
        phone: '+2348030000000',
        isPrimaryContact: true,
      },
    ],
    documents: [],
    status: 'ACCEPTED',
    offeredClassId: null,
    offeredClassName: null,
    timeline: [],
    version: 1,
    ...over,
  };
}

/**
 * "Admit without screening" sets the offer and accepts the application in the
 * same step, on an admission this dialog was already mounted for — it stays
 * mounted the whole time the detail page is open, only hidden until "Enrol as
 * a student" is clicked. `useForm`'s `defaultValues` is a one-time snapshot,
 * so a class that arrives after that first mount needs an explicit reset to
 * ever reach the field; without it, the offer shows correctly in the hint
 * text (a live prop) while the select itself stays on "Select a class".
 */
describe('ConvertApplicantDialog', () => {
  it('pre-selects a class offered before the dialog first mounted', async () => {
    renderDialog({
      application: application({ offeredClassId: 'cls_2', offeredClassName: 'Senior Secondary 1' }),
      open: true,
      onOpenChange: vi.fn(),
    });

    const select = (await screen.findByLabelText(/^Class/)) as HTMLSelectElement;
    expect(select.value).toBe('cls_2');
    const option = within(select).getByText('Senior Secondary 1') as HTMLOptionElement;
    expect(option.selected).toBe(true);
  });

  it('fills in the class once an offer arrives after the dialog already mounted blank', async () => {
    const { rerender } = renderDialog({
      application: application(),
      open: true,
      onOpenChange: vi.fn(),
    });

    let select = (await screen.findByLabelText(/^Class/)) as HTMLSelectElement;
    expect(select.value).toBe('');

    rerender(
      <MemoryRouter>
        <ConvertApplicantDialog
          application={application({ offeredClassId: 'cls_2', offeredClassName: 'Senior Secondary 1' })}
          open
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    select = (await screen.findByLabelText(/^Class/)) as HTMLSelectElement;
    expect(select.value).toBe('cls_2');
  });
});
