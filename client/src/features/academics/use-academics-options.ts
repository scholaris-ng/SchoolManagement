import type { SelectOption } from '@/components/ui/input';
import {
  useAcademicSessions,
  useClasses,
  useHouses,
  useLevels,
  useSubjects,
  useTerms,
} from './use-academics';
import type { SubjectQuery } from './academics.endpoints';

/** Picker options, derived from the structure reads above. */

export function useClassOptions(levelId?: string): SelectOption[] {
  const { data } = useClasses(levelId ? { levelId } : {});
  return (data ?? []).map((schoolClass) => ({
    value: schoolClass.id,
    label: schoolClass.name,
    description: `${schoolClass.levelName} · ${schoolClass.enrolledCount} students`,
  }));
}

export function useSubjectOptions(query: SubjectQuery = {}): SelectOption[] {
  const { data } = useSubjects(query);
  return (data ?? []).map((subject) => ({
    value: subject.id,
    label: subject.name,
    description: subject.code,
  }));
}

export function useLevelOptions(): SelectOption[] {
  const { data } = useLevels();
  return (data ?? []).map((level) => ({ value: level.id, label: level.name }));
}

export function useTermOptions(sessionId?: string): SelectOption[] {
  const { data } = useTerms(sessionId);
  return (data ?? []).map((term) => ({
    value: term.id,
    label: term.name,
    description: term.sessionName,
  }));
}

export function useSessionOptions(): SelectOption[] {
  const { data } = useAcademicSessions();
  return (data ?? []).map((session) => ({
    value: session.id,
    label: session.name,
    description: session.isCurrent ? 'Current session' : undefined,
  }));
}

export function useHouseOptions(): SelectOption[] {
  const { data } = useHouses();
  return (data ?? []).map((house) => ({ value: house.id, label: house.name }));
}
