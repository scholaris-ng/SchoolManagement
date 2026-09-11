import type { EntityManager } from 'typeorm';
import type { RequestContext } from '../../../shared/types/context';
import { SubjectRepository } from '../../academics/repositories/subject.repository';
import { LevelRepository } from '../../academics/repositories/level.repository';
import type { ImportEntityHandler, MappedRow, RowCheck, RowContext } from './importHandler.interface';
import { issue, matchKey } from './importHandler.interface';
import { normaliseSpacing, parseBooleanCell, splitList } from '../utils/cells';

interface SubjectLookups {
  /** Level id and canonical name, keyed by the name normalised for matching. */
  levelsByName: Map<string, { id: string; name: string }>;
  existingByCode: Map<string, { id: string }>;
}

/** Subjects: code is the key, levels are an optional set of names. */
export class SubjectsImportHandler implements ImportEntityHandler<SubjectLookups> {
  readonly entity = 'SUBJECTS' as const;
  readonly naturalKeyField = 'code';
  readonly naturalKeyLabel = 'subject code';

  private readonly subjects = SubjectRepository.Instance;
  private readonly levels = LevelRepository.Instance;

  naturalKey(row: MappedRow): string | null {
    return row.code?.trim().toUpperCase() || null;
  }

  async prepare(
    context: RequestContext,
    rows: MappedRow[],
    manager?: EntityManager,
  ): Promise<SubjectLookups> {
    const codes = rows.map((row) => this.naturalKey(row)).filter((code): code is string => Boolean(code));
    const [levels, existing] = await Promise.all([
      this.levels.findAllForMatching(context.schoolId, manager),
      this.subjects.findManyByCode(context.schoolId, codes, manager),
    ]);

    return {
      levelsByName: new Map(levels.map((level) => [matchKey(level.name), level])),
      existingByCode: new Map(existing.map((row) => [row.code.toUpperCase(), { id: row.id }])),
    };
  }

  async check({ rowNumber, row, lookups }: RowContext<SubjectLookups>): Promise<RowCheck> {
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

    const { matched, missing } = this.resolveLevels(row.levelNames, lookups);
    for (const levelName of missing) {
      issues.push(
        issue(rowNumber, 'WARNING', 'LEVEL_NOT_FOUND', `No level called "${levelName}" — that link was skipped.`, 'levelNames', levelName),
      );
    }

    return {
      issues,
      willUpdate: Boolean(code && lookups.existingByCode.has(code)),
      preview: {
        name,
        code,
        category: normaliseSpacing(row.category ?? ''),
        isCore: core.value ? 'TRUE' : 'FALSE',
        levelNames: matched.map((level) => level.name).join('; '),
      },
    };
  }

  async apply({ context, row, lookups, manager }: RowContext<SubjectLookups>): Promise<'CREATED' | 'UPDATED'> {
    const name = normaliseSpacing(row.name);
    const code = row.code.trim().toUpperCase();
    const category = normaliseSpacing(row.category ?? '') || null;
    const isCore = parseBooleanCell(row.isCore, true).value;
    const levelIds = this.resolveLevels(row.levelNames, lookups).matched.map((level) => level.id);

    const existing = lookups.existingByCode.get(code);
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
    // Keeps a code repeated later in the same file an update, not a second insert.
    lookups.existingByCode.set(code, { id: created.id });
    if (levelIds.length > 0) {
      await this.subjects.replaceLevels(context.schoolId, created.id, levelIds, manager);
    }
    return 'CREATED';
  }

  private resolveLevels(
    raw: string | undefined,
    lookups: SubjectLookups,
  ): { matched: { id: string; name: string }[]; missing: string[] } {
    const names = splitList(raw);
    const matched: { id: string; name: string }[] = [];
    const missing: string[] = [];
    for (const name of names) {
      const level = lookups.levelsByName.get(matchKey(name));
      if (level) matched.push(level);
      else missing.push(name);
    }
    return { matched, missing };
  }
}
