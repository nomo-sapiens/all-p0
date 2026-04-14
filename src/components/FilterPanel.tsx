import { useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewFilters } from '@/hooks/useReviewFilters';
import type { PullRequest } from '@/types';

interface FilterPanelProps {
  allPRs: PullRequest[];
  filters: ReviewFilters;
  onSetFilters: (f: ReviewFilters) => void;
  onClearFilters: () => void;
  isActive: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function FilterPanel({
  allPRs,
  filters,
  onSetFilters,
  onClearFilters,
  isActive,
  open,
  onToggle,
  onClose,
}: FilterPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  // Derive unique authors and repos from the unfiltered list
  const uniqueAuthors = Array.from(new Set(allPRs.map((pr) => pr.author))).sort();
  const uniqueRepos = Array.from(new Set(allPRs.map((pr) => pr.repo))).sort();

  const activeCount =
    filters.authors.length + filters.repos.length;

  const toggleAuthor = (author: string) => {
    const current = new Set(filters.authors);
    if (current.has(author)) {
      current.delete(author);
    } else {
      current.add(author);
    }
    onSetFilters({ ...filters, authors: Array.from(current) });
  };

  const toggleRepo = (repo: string) => {
    const current = new Set(filters.repos);
    if (current.has(repo)) {
      current.delete(repo);
    } else {
      current.add(repo);
    }
    onSetFilters({ ...filters, repos: Array.from(current) });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
          open || isActive
            ? 'bg-accent-muted text-accent-text border border-accent/30'
            : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary border border-transparent'
        )}
        title="Filter"
        aria-label="Filter"
      >
        <Filter size={13} />
        <span>Filter</span>
        {isActive && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xs font-bold bg-accent text-bg-primary">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-bg-secondary border border-border rounded-lg shadow-lg w-64 max-h-80 overflow-y-auto">
          {uniqueAuthors.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-2">
                Authors
              </p>
              <div className="space-y-1">
                {uniqueAuthors.map((author) => (
                  <label
                    key={author}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={filters.authors.includes(author)}
                      onChange={() => toggleAuthor(author)}
                      className="w-3.5 h-3.5 rounded border-border accent-accent-text cursor-pointer"
                    />
                    <span className="text-xs text-fg-primary group-hover:text-accent-text transition-colors">
                      @{author}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {uniqueRepos.length > 0 && (
            <div className={cn('p-3', uniqueAuthors.length > 0 && 'border-t border-border')}>
              <p className="text-xs font-semibold text-fg-secondary uppercase tracking-wide mb-2">
                Projects
              </p>
              <div className="space-y-1">
                {uniqueRepos.map((repo) => (
                  <label
                    key={repo}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={filters.repos.includes(repo)}
                      onChange={() => toggleRepo(repo)}
                      className="w-3.5 h-3.5 rounded border-border accent-accent-text cursor-pointer"
                    />
                    <span className="text-xs text-fg-primary group-hover:text-accent-text transition-colors">
                      {repo}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {isActive && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => {
                  onClearFilters();
                  onClose();
                }}
                className="w-full text-xs text-fg-muted hover:text-danger transition-colors text-left"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
