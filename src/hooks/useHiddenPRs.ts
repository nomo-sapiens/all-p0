import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { getHiddenPRs, hidePR, unhidePR } from '@/lib/api';
import type { Pane } from '@/types';

function hiddenQueryKey(pane: Pane) {
  return ['hidden', pane] as const;
}

export function useHiddenPRs(pane: Pane): Set<string> {
  const { data } = useQuery({
    queryKey: hiddenQueryKey(pane),
    queryFn: () => getHiddenPRs(pane),
    staleTime: 25_000,
    refetchInterval: 30_000,
    retry: 2,
  });
  return new Set(data ?? []);
}

export function useHidePR(pane: Pane) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hidePR(id, pane),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hiddenQueryKey(pane) });
    },
  });
}

export function useUnhidePR(pane: Pane) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unhidePR(id, pane),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hiddenQueryKey(pane) });
    },
  });
}
