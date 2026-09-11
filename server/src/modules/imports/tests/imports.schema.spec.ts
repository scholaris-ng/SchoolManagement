import {
  MAX_IMPORT_ROWS,
  commitImportSchema,
  importIdParamSchema,
  validateImportSchema,
} from '../validators/imports.schema';
import { mapRow } from '../services/imports.service';

const wrap = (part: { body?: unknown; query?: unknown; params?: unknown }) => ({
  body: part.body ?? {},
  query: part.query ?? {},
  params: part.params ?? {},
});

const validBody = {
  entity: 'STAFF',
  fileName: 'staff-import-template.xlsx',
  mapping: { staffNo: 'Staff number', firstName: 'First name', department: null },
  rows: [{ 'Staff number': 'STF/018', 'First name': 'Ada' }],
};

describe('validateImportSchema', () => {
  it('accepts a well-formed file, including columns mapped to nothing', () => {
    const result = validateImportSchema.safeParse(wrap({ body: validBody }));
    expect(result.success).toBe(true);
  });

  it.each(['STUDENTS', 'GUARDIANS', 'STAFF', 'SUBJECTS', 'FEES'])(
    'accepts %s as an entity',
    (entity) => {
      const result = validateImportSchema.safeParse(wrap({ body: { ...validBody, entity } }));
      expect(result.success).toBe(true);
    },
  );

  it('rejects an entity nobody can import', () => {
    const result = validateImportSchema.safeParse(wrap({ body: { ...validBody, entity: 'BUSES' } }));
    expect(result.success).toBe(false);
  });

  it('rejects a file with no rows', () => {
    const result = validateImportSchema.safeParse(wrap({ body: { ...validBody, rows: [] } }));
    expect(result.success).toBe(false);
  });

  it('refuses a file past the row cap rather than holding it all in one column', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ 'Staff number': 'STF/1' }));
    const result = validateImportSchema.safeParse(wrap({ body: { ...validBody, rows } }));
    expect(result.success).toBe(false);
  });

  it('rejects an unknown field, so a typo is not silently ignored', () => {
    const result = validateImportSchema.safeParse(
      wrap({ body: { ...validBody, sheetName: 'Sheet1' } }),
    );
    expect(result.success).toBe(false);
  });
});

describe('commitImportSchema', () => {
  it('needs the id of something already validated, and a decision about bad rows', () => {
    const result = commitImportSchema.safeParse(
      wrap({
        body: {
          importId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
          skipInvalidRows: true,
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an id that is not one we could have issued', () => {
    const result = commitImportSchema.safeParse(
      wrap({ body: { importId: 'latest', skipInvalidRows: false } }),
    );
    expect(result.success).toBe(false);
  });

  it('will not default the skip decision — it changes whether anything is saved', () => {
    const result = commitImportSchema.safeParse(
      wrap({ body: { importId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' } }),
    );
    expect(result.success).toBe(false);
  });
});

describe('importIdParamSchema', () => {
  it('accepts the id an import was given', () => {
    const result = importIdParamSchema.safeParse(
      wrap({ params: { id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' } }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects anything that could not be one, so polling cannot be used to probe', () => {
    expect(importIdParamSchema.safeParse(wrap({ params: { id: 'latest' } })).success).toBe(false);
    expect(importIdParamSchema.safeParse(wrap({ params: {} })).success).toBe(false);
  });
});

describe('mapRow', () => {
  const mapping = { staffNo: 'Staff number', firstName: 'First name', department: null };

  it('turns a spreadsheet row into the fields the importer works in', () => {
    expect(mapRow({ 'Staff number': ' STF/018 ', 'First name': 'Ada' }, mapping)).toEqual({
      staffNo: 'STF/018',
      firstName: 'Ada',
    });
  });

  it('leaves an unmapped column out entirely rather than guessing at it', () => {
    const mapped = mapRow({ 'Staff number': 'STF/018' }, mapping);
    expect(mapped.department).toBeUndefined();
  });

  it('reads a column the file never had as empty, not undefined', () => {
    expect(mapRow({ 'Staff number': 'STF/018' }, mapping).firstName).toBe('');
  });
});
