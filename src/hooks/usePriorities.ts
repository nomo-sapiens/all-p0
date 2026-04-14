import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getAllPriorities, setPrPriority, clearPrPriority } from '@/lib/api';
import type { Priority } from '@/types';

const PRIORITIES_QUERY_KEY = ['priorities'] as const;

export function usePriorities(): UseQueryResult<Record<string, Priority>> {
  return useQuery({
    queryKey: PRIORITIES_QUERY_KEY,
    queryFn: getAllPriorities,
    staleTime: 25_000,
  });
}

export function useSetPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Priority }) =>
      setPrPriority(id, priority),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRIORITIES_QUERY_KEY });
    },
  });
}

export function useClearPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clearPrPriority(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PRIORITIES_QUERY_KEY });
    },
  });
}
