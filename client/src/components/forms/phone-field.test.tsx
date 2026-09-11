import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PhoneNumberInput } from './phone-field';

/**
 * Numbers reach this widget in whatever shape their source used. Bulk import in
 * particular carries the spacing a school typed into a spreadsheet, so the dial
 * code has to be recognised through it rather than only in the tight
 * `+2348012345678` form the staff form itself emits.
 */

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PhoneNumberInput value={value} onChange={setValue} />
      <output data-testid="stored">{value}</output>
    </>
  );
}

const dialCode = () => screen.getByLabelText('Country dial code');
const localNumber = () => screen.getByPlaceholderText('Phone number');
const stored = () => screen.getByTestId('stored').textContent;

describe('PhoneNumberInput — splitting a stored number', () => {
  it('splits the tight form the forms already save', () => {
    render(<Harness initial="+2348012345678" />);
    expect(dialCode()).toHaveTextContent('+234');
    expect(localNumber()).toHaveValue('8012345678');
  });

  it('splits a spaced number, as a bulk import supplies it', () => {
    render(<Harness initial="+234 802 311 4501" />);
    expect(dialCode()).toHaveTextContent('+234');
    expect(localNumber()).toHaveValue('802 311 4501');
  });

  it('takes the country from the number rather than the default', () => {
    render(<Harness initial="+44 20 7946 0018" />);
    expect(dialCode()).toHaveTextContent('+44');
    expect(localNumber()).toHaveValue('20 7946 0018');
  });

  it('falls back to the default country when the number carries no dial code', () => {
    render(<Harness initial="08023114501" />);
    expect(dialCode()).toHaveTextContent('+234');
    expect(localNumber()).toHaveValue('08023114501');
  });
});

describe('PhoneNumberInput — editing', () => {
  it('normalises an imported number once it is touched', async () => {
    const user = userEvent.setup();
    render(<Harness initial="+234 802 311 4501" />);

    await user.type(localNumber(), '2');
    expect(stored()).toBe('+23480231145012');
  });

  it('clears to nothing rather than leaving a bare dial code', async () => {
    const user = userEvent.setup();
    render(<Harness initial="+2348012345678" />);

    await user.clear(localNumber());
    expect(stored()).toBe('');
  });
});
