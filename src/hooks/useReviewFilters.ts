import { useState, useCallback } from 'react';

export interface ReviewFilters {
  authors: string[];
  repos: string[];
}

const STORAGE_KEY = 'allp0-review-filters';

function loadFilters(): ReviewFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { authors: [], repos: [] };
    const parsed = JSON.parse(raw) as ReviewFilters;
    return {
      authors: Array.isArray(parsed.authors) ? parsed.authors : [],
      repos: Array.isArray(parsed.repos) ? parsed.repos : [],
    };
  } catch {
    return { authors: [], repos: [] };
  }
}

function saveFilters(filters: ReviewFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore storage errors
  }
}

export function useReviewFilters() {
  const [filters, setFiltersState] = useState<ReviewFilters>(loadFilters);

  const setFilters = useCallback((f: ReviewFilters) => {
    setFiltersState(f);
    saveFilters(f);
  }, []);

  const clearFilters = useCallback(() => {
    const empty: ReviewFilters = { authors: [], repos: [] };
    setFiltersState(empty);
    saveFilters(empty);
  }, []);

  const isActive = filters.authors.length > 0 || filters.repos.length > 0;

  return { filters, setFilters, clearFilters, isActive };
}
