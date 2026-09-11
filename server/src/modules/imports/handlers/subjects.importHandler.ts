import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { LevelRepository } from '../../academics/repositories/level.repository';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue } from './importHandler.interface';
import { normaliseSpacing, parseBooleanCell, splitList } from '../utils/cells';

/** Subjects: code is the key, levels are an optional set of names. */
export class SubjectsImportHandler implements ImportEntityHandler {
  readonly entity = 'SUBJECTS' as const;
  readonly naturalKeyField = 'code';
  readonly naturalKeyLabel = 'subject code';

  private readonly subjects = SubjectRepository.Instance;
  private readonly levels = LevelRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.code?.trim().toUpperCase() || null;
  }

  async check({ context, rowNumber, row, manager }: RowContext): Promise<RowCheck> {
    const issues = [];
    const name = normaliseSpacing(row.name ?? '');
    const code = (row.code ?? '').trim().toUpperCase();

    if (!name) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A subject name is required.', 'name'));
    if (!code) issues.push(issue(rowNumber, 'ERROR', 'REQUIRED', 'A subject code is required.', 'code'));
    if (code.length > 20) {
      issues.push(issue(rowNumber, 'ERROR', 'TOO_LONG', 'A subject code can be at most 20 characters.', 'code', code));
    }

    const core = parseBooleanCell(row.isCore, true);
    if (core.warning) {
      issues.push(issue(rowNumber, 'WARNING', 'UNREADABLE_BOOLEAN', core.warning, 'isCore', row.isCore));
    }

    const { matched, missing } = await this.resolveLevels(context.schoolId, row.levelNames, manager);
    for (const name of missing) {
      issues.push(
        issue(rowNumber, 'WARNING', 'LEVEL_NOT_FOUND', `No level called "${name}" — that link was skipped.`, 'levelNames', name),
      );
    }

    const existing = code ? await this.subjects.findByCode(context.schoolId, code, manager) : null;

    return {
      issues,
      willUpdate: Boolean(existing),
      preview: {
        name,
        code,
        category: normaliseSpacing(row.category ?? ''),
        isCore: core.value ? 'TRUE' : 'FALSE',
        levelNames: matched.map((level) => level.name).join('; '),
      },
    };
  }

  async apply({ context, row, manager }: RowContext): Promise<'CREATED' | 'UPDATED'> {
    const name = normaliseSpacing(row.name);
    const code = row.code.trim().toUpperCase();
    const category = normaliseSpacing(row.category ?? '') || null;
    const isCore = parseBooleanCell(row.isCore, true).value;

    const { matched } = await this.resolveLevels(context.schoolId, row.levelNames, manager);
    const levelIds = matched.map((level) => level.id);
    const existing = await this.subjects.findByCode(context.schoolId, code, manager);

    if (existing) {
      await this.subjects.update(existing.id, { name, category, isCore }, manager);
      // Only touched when the sheet actually carried a Levels column, so an
      // import that omits it leaves a subject's existing levels alone.
      if (row.levelNames?.trim()) {
        await this.subjects.replaceLevels(context.schoolId, existing.id, levelIds, manager);
      }
      return 'UPDATED';
    }

    const created = await this.subjects.create(
      { schoolId: context.schoolId, name, code, category, isCore, isActive: true, schedule: [] },
      manager,
    );
    if (levelIds.length > 0) {
      await this.subjects.replaceLevels(context.schoolId, created.id, levelIds, manager);
    }
    return 'CREATED';
  }

  private async resolveLevels(
    schoolId: string,
    raw: string | undefined,
    manager?: RowContext['manager'],
  ): Promise<{ matched: { id: string; name: string }[]; missing: string[] }> {
    const names = splitList(raw);
    if (names.length === 0) return { matched: [], missing: [] };

    const found = await this.levels.findByNames(schoolId, names, manager);
    const byName = new Map(found.map((level) => [normaliseSpacing(level.name).toLowerCase(), level]));

    const matched: { id: string; name: string }[] = [];
    const missing: string[] = [];
    for (const name of names) {
      const level = byName.get(normaliseSpacing(name).toLowerCase());
      if (level) matched.push(level);
      else missing.push(name);
    }
    return { matched, missing };
  }
}
