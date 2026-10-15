import {
  changesBilling,
  diffSnapshots,
  isoDay,
  planCarriedSync,
  planLineSync,
  snapshotOf,
  statusAfterEdit,
  type InvoiceSnapshot,
  type RevisionLine,
} from '../services/invoiceRevisions';

const line = (over: Partial<RevisionLine> & Pick<RevisionLine, 'feeItemId' | 'description'>): RevisionLine => ({
  quantity: 1,
  unitAmount: 0,
  discountAmount: 0,
  lineTotal: 0,
  isOptional: false,
  ...over,
});

const snapshot = (over: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot => ({
  dueDate: '2026-11-13',
  note: null,
  lines: [],
  subtotal: 0,
  discountTotal: 0,
  appliedDiscounts: [],
  broughtForward: 0,
  total: 0,
  ...over,
});

describe('diffSnapshots', () => {
  const tuition = line({ feeItemId: 'tuition', description: 'Tuition', unitAmount: 185_000, lineTotal: 185_000 });
  const uniform = line({ feeItemId: 'uniform', description: 'Uniform', unitAmount: 85_000, lineTotal: 85_000 });

  it('reports nothing when nothing moved', () => {
    const same = snapshot({ lines: [tuition], subtotal: 185_000, total: 185_000 });
    expect(diffSnapshots(same, { ...same })).toEqual([]);
  });

  it('names a removed charge and the total that moved with it', () => {
    const before = snapshot({ lines: [tuition, uniform], subtotal: 270_000, total: 270_000 });
    const after = snapshot({ lines: [tuition], subtotal: 185_000, total: 185_000 });

    expect(diffSnapshots(before, after)).toEqual([
      { kind: 'LINE_REMOVED', label: 'Uniform', from: 85_000, to: null, detail: null },
      { kind: 'TOTAL', label: null, from: 270_000, to: 185_000, detail: null },
    ]);
  });

  it('reports an added charge', () => {
    const before = snapshot({ lines: [tuition], subtotal: 185_000, total: 185_000 });
    const after = snapshot({ lines: [tuition, uniform], subtotal: 270_000, total: 270_000 });

    expect(diffSnapshots(before, after)[0]).toEqual({
      kind: 'LINE_ADDED',
      label: 'Uniform',
      from: null,
      to: 85_000,
      detail: null,
    });
  });

  it('reports a repriced charge and says what about it changed', () => {
    const before = snapshot({ lines: [uniform], subtotal: 85_000, total: 85_000 });
    const cheaper = line({ feeItemId: 'uniform', description: 'Uniform', unitAmount: 75_000, lineTotal: 75_000 });
    const after = snapshot({ lines: [cheaper], subtotal: 75_000, total: 75_000 });

    expect(diffSnapshots(before, after)[0]).toEqual({
      kind: 'LINE_CHANGED',
      label: 'Uniform',
      from: 85_000,
      to: 75_000,
      detail: 'Price changed',
    });
  });

  it('reports a quantity change even when the line total happens not to move', () => {
    const before = snapshot({ lines: [uniform] });
    const doubled = line({
      feeItemId: 'uniform',
      description: 'Uniform',
      quantity: 2,
      unitAmount: 42_500,
      lineTotal: 85_000,
    });

    const [change] = diffSnapshots(before, snapshot({ lines: [doubled] }));
    expect(change.kind).toBe('LINE_CHANGED');
    expect(change.detail).toBe('Quantity 1 → 2 · Price changed');
  });

  it('treats one cent of float noise as no change', () => {
    const before = snapshot({ total: 0.1 + 0.2 });
    expect(diffSnapshots(before, snapshot({ total: 0.3 }))).toEqual([]);
  });

  it('reports a moved due date and an edited note, but not as billing', () => {
    const changes = diffSnapshots(
      snapshot({ dueDate: '2026-11-13', note: 'Pay on time' }),
      snapshot({ dueDate: '2026-11-20', note: 'Pay by 20 Nov' }),
    );

    expect(changes.map((change) => change.kind)).toEqual(['DUE_DATE', 'NOTE']);
    expect(changesBilling(changes)).toBe(false);
  });

  it('reports what was brought forward moving, and counts it as billing', () => {
    const changes = diffSnapshots(
      snapshot({ broughtForward: 106_000, total: 106_000 }),
      snapshot({ broughtForward: 46_000, total: 46_000 }),
    );

    expect(changes).toEqual([
      { kind: 'BROUGHT_FORWARD', label: null, from: 106_000, to: 46_000, detail: null },
      { kind: 'TOTAL', label: null, from: 106_000, to: 46_000, detail: null },
    ]);
    expect(changesBilling(changes)).toBe(true);
  });

  it('pairs a fee item that appears twice one-to-one', () => {
    const first = line({ feeItemId: 'trip', description: 'Trip', lineTotal: 5_000 });
    const second = line({ feeItemId: 'trip', description: 'Trip', lineTotal: 5_000 });

    const changes = diffSnapshots(snapshot({ lines: [first, second] }), snapshot({ lines: [first] }));
    expect(changes).toEqual([
      { kind: 'LINE_REMOVED', label: 'Trip', from: 5_000, to: null, detail: null },
    ]);
  });
});

describe('changesBilling', () => {
  it('is true for any change to what the family is billed', () => {
    for (const kind of ['LINE_ADDED', 'LINE_REMOVED', 'LINE_CHANGED', 'DISCOUNT', 'TOTAL'] as const) {
      expect(changesBilling([{ kind, label: null, from: 1, to: 2, detail: null }])).toBe(true);
    }
  });
});

describe('snapshotOf', () => {
  it('keeps the invoice\'s own charges and leaves out lines carried in from another invoice', () => {
    const snap = snapshotOf({
      dueDate: new Date('2026-11-13T00:00:00Z'),
      note: '',
      subtotal: 100,
      discountTotal: 0,
      broughtForward: 50,
      total: 150,
      appliedDiscounts: [],
      lines: [
        {
          feeItemId: 'a',
          description: 'Own',
          quantity: 1,
          unitAmount: 100,
          discountAmount: 0,
          lineTotal: 100,
          isOptional: false,
          carriedFromInvoiceId: null,
        },
        {
          feeItemId: 'b',
          description: 'Carried',
          quantity: 1,
          unitAmount: 50,
          discountAmount: 0,
          lineTotal: 50,
          isOptional: false,
          carriedFromInvoiceId: 'older',
        },
      ],
    });

    expect(snap.lines.map((entry) => entry.description)).toEqual(['Own']);
    expect(snap.dueDate).toBe('2026-11-13');
    expect(snap.note).toBeNull();
  });
});

describe('isoDay', () => {
  it('reads the same day from a string or a Date', () => {
    expect(isoDay('2026-11-13')).toBe('2026-11-13');
    expect(isoDay(new Date('2026-11-13T00:00:00Z'))).toBe('2026-11-13');
  });
});

describe('planLineSync', () => {
  it('keeps a surviving charge by id, inserts a new one and removes the one that went', () => {
    const plan = planLineSync(
      [
        { id: 'l-tuition', feeItemId: 'tuition' },
        { id: 'l-uniform', feeItemId: 'uniform' },
      ],
      [{ feeItemId: 'tuition' }, { feeItemId: 'books' }],
    );

    expect(plan).toEqual({
      keep: [{ id: 'l-tuition', index: 0 }],
      insert: [1],
      remove: ['l-uniform'],
    });
  });

  it('keeps a charge in place when only its position changes', () => {
    const plan = planLineSync(
      [
        { id: 'l-a', feeItemId: 'a' },
        { id: 'l-b', feeItemId: 'b' },
      ],
      [{ feeItemId: 'b' }, { feeItemId: 'a' }],
    );

    expect(plan.keep).toEqual([
      { id: 'l-b', index: 0 },
      { id: 'l-a', index: 1 },
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
});

describe('planCarriedSync', () => {
  const copy = (id: string, feeItemId: string, total: number, paid = 0) => ({
    id,
    feeItemId,
    totalKobo: total * 100,
    paidKobo: paid * 100,
  });

  it('removes a carried charge whose source charge was removed', () => {
    const plan = planCarriedSync(
      [copy('c-test', 'test', 60_000), copy('c-tuition', 'tuition', 25_000)],
      [{ feeItemId: 'test', deltaKobo: -100_000 * 100 }],
    );

    // The source charge was ₦100,000 with ₦40,000 paid, so ₦60,000 was carried;
    // removing the whole charge takes the carried ₦60,000 below zero.
    expect(plan.remove).toEqual(['c-test']);
    expect(plan.update).toEqual([]);
  });

  it('moves a carried charge by exactly what its source charge moved by', () => {
    const plan = planCarriedSync(
      [copy('c-tuition', 'tuition', 25_000)],
      [{ feeItemId: 'tuition', deltaKobo: -5_000 * 100 }],
    );

    expect(plan.update).toEqual([
      { id: 'c-tuition', totalKobo: 20_000 * 100, belowPaid: false },
    ]);
  });

  it('starts a carried charge for an item that had been settled and is now billed higher', () => {
    const plan = planCarriedSync([], [{ feeItemId: 'books', deltaKobo: 10_000 * 100 }]);

    expect(plan.insert).toEqual([{ feeItemId: 'books', totalKobo: 10_000 * 100 }]);
  });

  it('has nothing to reduce where nothing was carried for the item', () => {
    const plan = planCarriedSync([], [{ feeItemId: 'books', deltaKobo: -10_000 * 100 }]);

    expect(plan).toEqual({ update: [], remove: [], insert: [] });
  });

  it('lets a carried charge fall below what has been paid towards it, and says so', () => {
    const plan = planCarriedSync(
      [copy('c-tuition', 'tuition', 25_000, 20_000)],
      [{ feeItemId: 'tuition', deltaKobo: -10_000 * 100 }],
    );

    // ₦15,000 left on a charge ₦20,000 had been itemised to: the caller trims
    // the itemisation back under it, and the payment stays on the invoice.
    expect(plan.update).toEqual([{ id: 'c-tuition', totalKobo: 15_000 * 100, belowPaid: true }]);
    expect(plan.remove).toEqual([]);
  });

  it('is not below what was paid when brought exactly to it', () => {
    const plan = planCarriedSync(
      [copy('c-tuition', 'tuition', 25_000, 20_000)],
      [{ feeItemId: 'tuition', deltaKobo: -5_000 * 100 }],
    );

    expect(plan.update).toEqual([{ id: 'c-tuition', totalKobo: 20_000 * 100, belowPaid: false }]);
  });

  it('removes a paid-towards carried charge whose source charge was taken off', () => {
    const plan = planCarriedSync(
      [copy('c-tuition', 'tuition', 25_000, 20_000)],
      [{ feeItemId: 'tuition', deltaKobo: -55_000 * 100 }],
    );

    expect(plan.remove).toEqual(['c-tuition']);
  });
});

describe('statusAfterEdit', () => {
  it('is ISSUED while nothing is paid', () => {
    expect(statusAfterEdit(455_000_00, 0)).toBe('ISSUED');
  });

  it('is PART_PAID once something is paid but not all', () => {
    expect(statusAfterEdit(370_000_00, 250_000_00)).toBe('PART_PAID');
  });

  it('settles an invoice an edit has brought level with what was paid', () => {
    expect(statusAfterEdit(150_000_00, 150_000_00)).toBe('PAID');
  });

  it('reopens a paid invoice when an edit raises the total above what was paid', () => {
    expect(statusAfterEdit(200_000_00, 150_000_00)).toBe('PART_PAID');
  });

  it('treats an invoice with nothing left to bill as paid', () => {
    expect(statusAfterEdit(0, 0)).toBe('PAID');
  });
});
