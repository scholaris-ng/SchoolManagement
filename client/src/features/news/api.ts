import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast-bus';
import { useSchoolId } from '@/app/providers/auth-provider';
import type { ListQuery } from '@/types/api';
import type { NewsPost } from '@/types/engagement';
import { NewsEndpoints } from './news.endpoints';

export function useNewsPosts(query: ListQuery) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.news.list(schoolId, query),
    queryFn: () => NewsEndpoints.fetchAll(query),
    enabled: Boolean(schoolId),
    placeholderData: keepPreviousData,
  });
}

export function useNewsPost(id: string | undefined) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: queryKeys.news.detail(schoolId, id ?? ''),
    queryFn: () => NewsEndpoints.fetchById(id ?? ''),
    enabled: Boolean(schoolId && id),
  });
}

/**
 * Publishing to the news feed.
 *
 * `containsStudentPhotos` is not a formality: the server refuses to make a post
 * public when it carries photographs of children whose guardians have not
 * recorded consent (spec section 41).
 */
export function useSaveNewsPost(id?: string) {
  const schoolId = useSchoolId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: Partial<NewsPost>) =>
      id ? NewsEndpoints.update(id, values) : NewsEndpoints.create(values),
    onSuccess: (post) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.news.list(schoolId) });
      queryClient.setQueryData(queryKeys.news.detail(schoolId, post.id), post);
      toast.success(post.status === 'PUBLISHED' ? 'Post published' : 'Draft saved');
    },
  });
}
