import type { ImportEntityName } from '../entities/importJob.entity';
import type { ImportEntityHandler } from './importHandler.interface';
import { StudentsImportHandler } from './students.importHandler';
import { GuardiansImportHandler } from './guardians.importHandler';
import { StaffImportHandler } from './staff.importHandler';
import { SubjectsImportHandler } from './subjects.importHandler';
import { FeesImportHandler } from './fees.importHandler';

export const IMPORT_HANDLERS: Record<ImportEntityName, ImportEntityHandler> = {
  STUDENTS: new StudentsImportHandler(),
  GUARDIANS: new GuardiansImportHandler(),
  STAFF: new StaffImportHandler(),
  SUBJECTS: new SubjectsImportHandler(),
  FEES: new FeesImportHandler(),
};

/**
 * Staff provisions a login per row through an external identity provider, so
 * its rows cannot join one database transaction the way the others can.
 */
export function runsInSharedTransaction(entity: ImportEntityName): boolean {
  return entity !== 'STAFF';
}
