import { GitPullRequest } from 'lucide-react';
import { RepoGroup } from './RepoGroup';
import { PRCard } from './PRCard';
import type { PullRequest, Pane } from '@/types';

interface PRListProps {
  prs: PullRequest[];
  hiddenIds: Set<string>;
  showHidden: boolean;
  pane: Pane;
  grouped: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}

export function PRList({
  prs,
  hiddenIds,
  showHidden,
  pane,
  grouped,
  onHide,
  onUnhide,
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

    return (
      <div className="space-y-1">
        {Array.from(groups.entries()).map(([repo, { repoUrl, prs: groupPRs }]) => (
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
          />
        ))}
      </div>
    );
  }

  // Flat list, sorted by updatedAt desc
  const sorted = [...visiblePRs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

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
        />
      ))}
    </div>
  );
}
