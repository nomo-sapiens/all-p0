import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  getMyPRs,
  getReviewPRs,
  getAuthStatus,
  addPrByUrl,
  removeFromReviewList,
} from '@/lib/api';
import type { PullRequest, AuthStatus } from '@/types';

const QUERY_OPTIONS = {
  staleTime: 25_000,
  refetchInterval: 30_000,
  retry: 2,
} as const;

export function useMyPRs(): UseQueryResult<PullRequest[]> {
  return useQuery({
    queryKey: ['prs', 'mine'],
    queryFn: getMyPRs,
    ...QUERY_OPTIONS,
  });
}

export function useReviewPRs(): UseQueryResult<PullRequest[]> {
  return useQuery({
    queryKey: ['prs', 'review'],
    queryFn: getReviewPRs,
    ...QUERY_OPTIONS,
  });
}

export function useAuthStatus(): UseQueryResult<AuthStatus> {
  return useQuery({
    queryKey: ['auth'],
    queryFn: getAuthStatus,
    ...QUERY_OPTIONS,
  });
}

export function useAddPrByUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => addPrByUrl(url),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prs', 'review'] });
    },
  });
}

export function useRemoveFromReviewList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeFromReviewList(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prs', 'review'] });
    },
  });
}
