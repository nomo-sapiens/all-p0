import { useState } from 'react';
import { FolderOpen, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMyPRs, useReviewPRs } from '@/hooks/usePRs';
import { useHiddenPRs, useHidePR, useUnhidePR } from '@/hooks/useHiddenPRs';
import { useQueryClient } from '@tanstack/react-query';
import { PRList } from './PRList';
import { UrlInput } from './UrlInput';
import type { Pane as PaneType } from '@/types';

interface PaneProps {
  title: string;
  pane: PaneType;
  isReview?: boolean;
}

function PRSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-bg-tertiary" />
        <div className="h-3 w-20 bg-bg-tertiary rounded" />
      </div>
      <div className="h-4 w-3/4 bg-bg-tertiary rounded mb-2" />
      <div className="flex gap-2">
        <div className="h-3 w-16 bg-bg-tertiary rounded" />
        <div className="h-3 w-10 bg-bg-tertiary rounded" />
        <div className="h-3 w-24 bg-bg-tertiary rounded" />
      </div>
    </div>
  );
}

export function Pane({ title, pane, isReview = false }: PaneProps) {
  const [grouped, setGrouped] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const queryClient = useQueryClient();
  const queryResult = isReview ? useReviewPRs() : useMyPRs();
  const { data: prs, isLoading, isError, error, isFetching, refetch } = queryResult;

  const hiddenIds = useHiddenPRs(pane);
  const { mutate: hidePR } = useHidePR(pane);
  const { mutate: unhidePR } = useUnhidePR(pane);

  const allPRs = prs ?? [];
  const hiddenCount = hiddenIds.size;

  const visibleCount = showHidden
    ? allPRs.length
    : allPRs.filter((pr) => !hiddenIds.has(pr.id)).length;

  const handleRefresh = () => {
    const key = isReview ? ['prs', 'review'] : ['prs', 'mine'];
    void queryClient.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-bg-primary border-r border-border last:border-r-0">
      {/* Pane header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-secondary flex-shrink-0">
        <h2 className="font-semibold text-fg-primary text-sm">{title}</h2>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium bg-bg-tertiary text-fg-secondary border border-border">
          {visibleCount}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {/* Group by repo toggle */}
          <button
            onClick={() => setGrouped((g) => !g)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              grouped
                ? 'bg-accent-muted text-accent-text border border-accent/30'
                : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary border border-transparent'
            )}
            title="Group by repo"
          >
            <FolderOpen size={13} />
            <span>Group</span>
          </button>

          {/* Show hidden toggle */}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((s) => !s)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                showHidden
                  ? 'bg-accent-muted text-accent-text border border-accent/30'
                  : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary border border-transparent'
              )}
              title={showHidden ? 'Hide hidden PRs' : 'Show hidden PRs'}
            >
              {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{hiddenCount} hidden</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center w-7 h-7 rounded text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={13}
              className={cn(isFetching && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* URL input for review pane */}
      {isReview && <UrlInput />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            <PRSkeleton />
            <PRSkeleton />
            <PRSkeleton />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={32} className="text-danger mb-3" strokeWidth={1.5} />
            <p className="text-fg-secondary font-medium mb-1">Failed to load PRs</p>
            <p className="text-fg-muted text-xs mb-4">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
            <button
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary hover:bg-border text-fg-secondary hover:text-fg-primary text-xs font-medium transition-colors border border-border"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        ) : (
          <PRList
            prs={allPRs}
            hiddenIds={hiddenIds}
            showHidden={showHidden}
            pane={pane}
            grouped={grouped}
            onHide={(id) => hidePR(id)}
            onUnhide={(id) => unhidePR(id)}
          />
        )}
      </div>

      {/* Loading indicator at top when fetching in background */}
      {isFetching && !isLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent animate-pulse" />
      )}
    </div>
  );
}
