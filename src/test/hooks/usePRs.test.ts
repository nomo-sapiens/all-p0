import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyPRs, useReviewPRs, useAuthStatus, useAddPrByUrl, useRemoveFromReviewList } from '@/hooks/usePRs';
import { makePR } from '../fixtures';

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

describe('useMyPRs', () => {
  it('calls get_my_prs command', async () => {
    const prs = [makePR()];
    mockInvoke.mockResolvedValueOnce(prs);

    const { result } = renderHook(() => useMyPRs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_my_prs');
    expect(result.current.data).toEqual(prs);
  });
});

describe('useReviewPRs', () => {
  it('calls get_review_prs command', async () => {
    const prs = [makePR({ id: 'owner/repo#2', number: 2 })];
    mockInvoke.mockResolvedValueOnce(prs);

    const { result } = renderHook(() => useReviewPRs(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_review_prs');
    expect(result.current.data).toEqual(prs);
  });
});

describe('useAuthStatus', () => {
  it('calls get_auth_status command', async () => {
    const authStatus = { authenticated: true, username: 'testuser' };
    mockInvoke.mockResolvedValueOnce(authStatus);

    const { result } = renderHook(() => useAuthStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_auth_status');
    expect(result.current.data).toEqual(authStatus);
  });
});

describe('useAddPrByUrl', () => {
  it('calls add_pr_by_url with url and invalidates review prs', async () => {
    const pr = makePR();
    mockInvoke.mockResolvedValueOnce([]) // initial review prs query
      .mockResolvedValueOnce(pr)  // add_pr_by_url
      .mockResolvedValueOnce([pr]); // invalidation refetch

    const wrapper = createWrapper();
    // Run review prs query first
    const { result: queryResult } = renderHook(() => useReviewPRs(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useAddPrByUrl(), { wrapper });

    result.current.mutate('https://github.com/owner/repo/pull/1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('add_pr_by_url', {
      url: 'https://github.com/owner/repo/pull/1',
    });
  });
});

describe('useRemoveFromReviewList', () => {
  it('calls remove_from_review_list with id', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useRemoveFromReviewList(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('owner/repo#1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('remove_from_review_list', {
      id: 'owner/repo#1',
    });
  });
});
