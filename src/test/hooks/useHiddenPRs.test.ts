import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHiddenPRs, useHidePR, useUnhidePR } from '@/hooks/useHiddenPRs';

const mockInvoke = vi.mocked(invoke);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useHiddenPRs', () => {
  it('returns a Set of hidden PR ids for mine pane', async () => {
    mockInvoke.mockResolvedValueOnce(['owner/repo#1', 'owner/repo#2']);

    const { result } = renderHook(() => useHiddenPRs('mine'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_hidden_prs', { pane: 'mine' });
    });

    await waitFor(() => {
      expect(result.current.has('owner/repo#1')).toBe(true);
      expect(result.current.has('owner/repo#2')).toBe(true);
    });
  });

  it('returns empty Set when no hidden PRs', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useHiddenPRs('review'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_hidden_prs', { pane: 'review' });
    });

    await waitFor(() => {
      expect(result.current.size).toBe(0);
    });
  });
});

describe('useHidePR', () => {
  it('calls hide_pr with id and pane', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // hide_pr
    mockInvoke.mockResolvedValueOnce([]); // invalidation refetch

    const { result } = renderHook(() => useHidePR('mine'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('owner/repo#1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('hide_pr', {
      id: 'owner/repo#1',
      pane: 'mine',
    });
  });
});

describe('useUnhidePR', () => {
  it('calls unhide_pr with id and pane', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // unhide_pr
    mockInvoke.mockResolvedValueOnce([]); // invalidation refetch

    const { result } = renderHook(() => useUnhidePR('review'), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('owner/repo#1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('unhide_pr', {
      id: 'owner/repo#1',
      pane: 'review',
    });
  });
});
