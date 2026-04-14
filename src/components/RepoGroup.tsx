import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { openInBrowser } from '@/lib/api';
import { PRCard } from './PRCard';
import type { PullRequest, Pane, Priority } from '@/types';

interface RepoGroupProps {
  repo: string;
  repoUrl: string;
  prs: PullRequest[];
  hiddenIds: Set<string>;
  showHidden: boolean;
  pane: Pane;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  priorities?: Record<string, Priority>;
  onSetPriority?: (id: string, priority: Priority | null) => void;
}

export function RepoGroup({
  repo,
  repoUrl,
  prs,
  hiddenIds,
  showHidden,
  pane,
  onHide,
  onUnhide,
  priorities = {},
  onSetPriority,
}: RepoGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  const visiblePRs = showHidden ? prs : prs.filter((pr) => !hiddenIds.has(pr.id));

  if (visiblePRs.length === 0) return null;

  const handleRepoLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    void openInBrowser(repoUrl);
  };

  return (
    <div className="mb-4">
      {/* Group header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <span className="text-fg-muted">
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <span className="font-semibold text-sm text-fg-primary group-hover:text-accent-text transition-colors">
          {repo}
        </span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium bg-accent-muted text-accent-text border border-accent/30">
          {visiblePRs.length}
        </span>
        <button
          onClick={handleRepoLinkClick}
          className="ml-1 text-fg-muted hover:text-accent-text transition-colors"
          title="Open repo"
        >
          <ExternalLink size={12} />
        </button>
      </button>

      {/* PRs */}
      {!collapsed && (
        <div className="space-y-2 ml-4">
          {prs.map((pr) => {
            const hidden = hiddenIds.has(pr.id);
            if (!showHidden && hidden) return null;
            return (
              <PRCard
                key={pr.id}
                pr={pr}
                pane={pane}
                isHidden={hidden}
                onHide={onHide}
                onUnhide={onUnhide}
                priority={priorities[pr.id]}
                onSetPriority={(p) => onSetPriority?.(pr.id, p)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
