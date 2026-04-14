import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReviewFilters } from '@/hooks/useReviewFilters';

const STORAGE_KEY = 'allp0-review-filters';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('useReviewFilters', () => {
  it('initializes with empty filters when no localStorage value', () => {
    const { result } = renderHook(() => useReviewFilters());
    expect(result.current.filters).toEqual({ authors: [], repos: [] });
    expect(result.current.isActive).toBe(false);
  });

  it('initializes from localStorage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ authors: ['alice'], repos: ['owner/repo'] })
    );
    const { result } = renderHook(() => useReviewFilters());
    expect(result.current.filters).toEqual({ authors: ['alice'], repos: ['owner/repo'] });
    expect(result.current.isActive).toBe(true);
  });

  it('setFilters updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useReviewFilters());

    act(() => {
      result.current.setFilters({ authors: ['bob'], repos: [] });
    });

    expect(result.current.filters).toEqual({ authors: ['bob'], repos: [] });
    expect(result.current.isActive).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored).toEqual({ authors: ['bob'], repos: [] });
  });

  it('clearFilters resets to empty and persists', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ authors: ['alice'], repos: ['owner/repo'] })
    );
    const { result } = renderHook(() => useReviewFilters());

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({ authors: [], repos: [] });
    expect(result.current.isActive).toBe(false);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored).toEqual({ authors: [], repos: [] });
  });

  it('isActive is true when authors filter is set', () => {
    const { result } = renderHook(() => useReviewFilters());

    act(() => {
      result.current.setFilters({ authors: ['alice'], repos: [] });
    });

    expect(result.current.isActive).toBe(true);
  });

  it('isActive is true when repos filter is set', () => {
    const { result } = renderHook(() => useReviewFilters());

    act(() => {
      result.current.setFilters({ authors: [], repos: ['owner/repo'] });
    });

    expect(result.current.isActive).toBe(true);
  });

  it('isActive is false when both filters are empty', () => {
    const { result } = renderHook(() => useReviewFilters());

    act(() => {
      result.current.setFilters({ authors: [], repos: [] });
    });

    expect(result.current.isActive).toBe(false);
  });

  it('handles invalid localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    const { result } = renderHook(() => useReviewFilters());
    expect(result.current.filters).toEqual({ authors: [], repos: [] });
    expect(result.current.isActive).toBe(false);
  });
});
