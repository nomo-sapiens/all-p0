import { GitPullRequest } from 'lucide-react';
import { RepoGroup } from './RepoGroup';
import { PRCard } from './PRCard';
import type { PullRequest, Pane, Priority, SortOrder } from '@/types';

interface PRListProps {
  prs: PullRequest[];
  hiddenIds: Set<string>;
  showHidden: boolean;
  pane: Pane;
  grouped: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  sortOrder?: SortOrder;
  priorities?: Record<string, Priority>;
  onSetPriority?: (id: string, priority: Priority | null) => void;
}

function sortPRs(prs: PullRequest[], sortOrder: SortOrder, priorities: Record<string, Priority>): PullRequest[] {
  const sorted = [...prs];
  if (sortOrder === 'created') {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortOrder === 'priority') {
    sorted.sort((a, b) => {
      const pa = priorities[a.id];
      const pb = priorities[b.id];
      if (pa !== undefined && pb !== undefined) {
        if (pa !== pb) return pa - pb;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  } else {
    // 'updated' (default)
    sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  return sorted;
}

export function PRList({
  prs,
  hiddenIds,
  showHidden,
  pane,
  grouped,
  onHide,
  onUnhide,
  sortOrder = 'updated',
  priorities = {},
  onSetPriority,
}: PRListProps) {
  const visiblePRs = showHidden ? prs : prs.filter((pr) => !hiddenIds.has(pr.id));

  if (visiblePRs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <GitPullRequest size={40} className="text-fg-muted mb-3" strokeWidth={1.5} />
        <p className="text-fg-secondary font-medium">No pull requests</p>
        <p className="text-fg-muted text-sm mt-1">
          {pane === 'mine'
            ? 'You have no open PRs right now.'
            : 'No PRs awaiting your review.'}
        </p>
      </div>
    );
  }

  if (grouped) {
    // Group by repo
    const groups = new Map<string, { repoUrl: string; prs: PullRequest[] }>();
    for (const pr of prs) {
      if (!groups.has(pr.repo)) {
        groups.set(pr.repo, { repoUrl: pr.repoUrl, prs: [] });
      }
      groups.get(pr.repo)!.prs.push(pr);
    }

    // Sort PRs within each group
    for (const group of groups.values()) {
      group.prs = sortPRs(group.prs, sortOrder, priorities);
    }

    // Sort the groups themselves
    const groupEntries = Array.from(groups.entries());
    if (sortOrder === 'priority') {
      groupEntries.sort(([, a], [, b]) => {
        const bestA = a.prs.reduce<Priority | undefined>((best, pr) => {
          const p = priorities[pr.id];
          if (p === undefined) return best;
          return best === undefined ? p : Math.min(best, p) as Priority;
        }, undefined);
        const bestB = b.prs.reduce<Priority | undefined>((best, pr) => {
          const p = priorities[pr.id];
          if (p === undefined) return best;
          return best === undefined ? p : Math.min(best, p) as Priority;
        }, undefined);
        if (bestA !== undefined && bestB !== undefined) return bestA - bestB;
        if (bestA !== undefined) return -1;
        if (bestB !== undefined) return 1;
        return 0;
      });
    } else if (sortOrder === 'created') {
      groupEntries.sort(([, a], [, b]) => {
        const latestA = Math.max(...a.prs.map((pr) => new Date(pr.createdAt).getTime()));
        const latestB = Math.max(...b.prs.map((pr) => new Date(pr.createdAt).getTime()));
        return latestB - latestA;
      });
    } else {
      groupEntries.sort(([, a], [, b]) => {
        const latestA = Math.max(...a.prs.map((pr) => new Date(pr.updatedAt).getTime()));
        const latestB = Math.max(...b.prs.map((pr) => new Date(pr.updatedAt).getTime()));
        return latestB - latestA;
      });
    }

    return (
      <div className="space-y-1">
        {groupEntries.map(([repo, { repoUrl, prs: groupPRs }]) => (
          <RepoGroup
            key={repo}
            repo={repo}
            repoUrl={repoUrl}
            prs={groupPRs}
            hiddenIds={hiddenIds}
            showHidden={showHidden}
            pane={pane}
            onHide={onHide}
            onUnhide={onUnhide}
            priorities={priorities}
            onSetPriority={onSetPriority}
          />
        ))}
      </div>
    );
  }

  // Flat list, sorted
  const sorted = sortPRs(visiblePRs, sortOrder, priorities);

  return (
    <div className="space-y-2">
      {sorted.map((pr) => (
        <PRCard
          key={pr.id}
          pr={pr}
          pane={pane}
          isHidden={hiddenIds.has(pr.id)}
          onHide={onHide}
          onUnhide={onUnhide}
          priority={priorities[pr.id]}
          onSetPriority={(p) => onSetPriority?.(pr.id, p)}
        />
      ))}
    </div>
  );
}
