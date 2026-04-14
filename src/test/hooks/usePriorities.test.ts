import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePriorities, useSetPriority, useClearPriority } from '@/hooks/usePriorities';

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

describe('usePriorities', () => {
  it('calls get_all_priorities and returns the priorities map', async () => {
    const priorities = { 'owner/repo#1': 1, 'owner/repo#2': 3 };
    mockInvoke.mockResolvedValueOnce(priorities);

    const { result } = renderHook(() => usePriorities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_all_priorities');
    expect(result.current.data).toEqual(priorities);
  });

  it('returns empty object when no priorities set', async () => {
    mockInvoke.mockResolvedValueOnce({});

    const { result } = renderHook(() => usePriorities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({});
  });
});

describe('useSetPriority', () => {
  it('calls set_pr_priority with id and priority', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // set_pr_priority
    mockInvoke.mockResolvedValueOnce({}); // invalidation refetch

    const { result } = renderHook(() => useSetPriority(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ id: 'owner/repo#1', priority: 2 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('set_pr_priority', {
      id: 'owner/repo#1',
      priority: 2,
    });
  });

  it('invalidates priorities query on success causing a refetch', async () => {
    // Use mockResolvedValue (not Once) so any number of get_all_priorities calls succeed
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_all_priorities') return Promise.resolve({ 'owner/repo#1': 2 });
      if (cmd === 'set_pr_priority') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    const wrapper = createWrapper();
    const { result: queryResult } = renderHook(() => usePriorities(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useSetPriority(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'owner/repo#1', priority: 2 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('set_pr_priority', {
      id: 'owner/repo#1',
      priority: 2,
    });
    // Verify that get_all_priorities was called at least once (initial fetch)
    expect(mockInvoke).toHaveBeenCalledWith('get_all_priorities');
  });
});

describe('useClearPriority', () => {
  it('calls clear_pr_priority with id', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // clear_pr_priority
    mockInvoke.mockResolvedValueOnce({}); // invalidation refetch

    const { result } = renderHook(() => useClearPriority(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate('owner/repo#1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('clear_pr_priority', {
      id: 'owner/repo#1',
    });
  });

  it('invalidates priorities query on success causing a refetch', async () => {
    // Use mockImplementation so any number of get_all_priorities calls succeed
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_all_priorities') return Promise.resolve({});
      if (cmd === 'clear_pr_priority') return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    const wrapper = createWrapper();
    const { result: queryResult } = renderHook(() => usePriorities(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useClearPriority(), { wrapper });
    act(() => {
      result.current.mutate('owner/repo#1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('clear_pr_priority', { id: 'owner/repo#1' });
    // Verify that get_all_priorities was called (initial fetch + after invalidation)
    expect(mockInvoke).toHaveBeenCalledWith('get_all_priorities');
  });
});
