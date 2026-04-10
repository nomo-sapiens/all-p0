import { Eye, EyeOff, ExternalLink, Pin } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { openInBrowser } from '@/lib/api';
import {
  ReviewDecisionBadge,
  MergeableBadge,
  ChecksStatusBadge,
  DraftBadge,
} from './StatusBadge';
import type { PullRequest, Pane } from '@/types';

interface PRCardProps {
  pr: PullRequest;
  pane: Pane;
  isHidden: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
}

export function PRCard({ pr, isHidden, onHide, onUnhide }: PRCardProps) {
  const handleTitleClick = () => {
    void openInBrowser(pr.url);
  };

  const handleRepoClick = () => {
    void openInBrowser(pr.repoUrl);
  };

  return (
    <div
      className={cn(
        'bg-bg-secondary border border-border rounded-lg p-3 hover:bg-bg-tertiary transition-colors',
        isHidden && 'opacity-50'
      )}
    >
      {/* Row 1: avatar + author + badges */}
      <div className="flex items-center gap-2 mb-1.5">
        <img
          src={pr.authorAvatar}
          alt={pr.author}
          className="w-5 h-5 rounded-full flex-shrink-0"
        />
        <span className="text-xs text-fg-secondary">@{pr.author}</span>

        {pr.isManual && (
          <span title="Manually added">
            <Pin size={11} className="text-accent-text" />
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {pr.isDraft && <DraftBadge />}
          <ReviewDecisionBadge decision={pr.reviewDecision} />
        </div>
      </div>

      {/* Row 2: title */}
      <button
        onClick={handleTitleClick}
        className="text-left text-sm font-medium text-fg-primary hover:text-accent-text transition-colors leading-snug mb-1.5 w-full"
      >
        {pr.title}
      </button>

      {/* Row 3: meta info */}
      <div className="flex items-center gap-2 text-xs text-fg-secondary mb-1.5 flex-wrap">
        <span className="text-fg-muted">{pr.repo}</span>
        <span className="text-fg-muted">·</span>
        <span>#{pr.number}</span>
        <span className="text-fg-muted">·</span>
        <span>{pr.approvals} approval{pr.approvals !== 1 ? 's' : ''}</span>
        <MergeableBadge mergeable={pr.mergeable} />
        <ChecksStatusBadge status={pr.checksStatus} />
        <span className="text-fg-muted ml-auto">
          {formatRelativeTime(pr.updatedAt)}
        </span>
      </div>

      {/* Row 4: labels + actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {pr.labels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-accent-muted text-accent-text border border-accent/30"
          >
            {label}
          </span>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleRepoClick}
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent-text transition-colors px-1.5 py-0.5 rounded hover:bg-bg-tertiary"
            title="Open repo"
          >
            <ExternalLink size={11} />
            <span>repo</span>
          </button>

          {isHidden ? (
            <button
              onClick={() => onUnhide(pr.id)}
              className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg-primary transition-colors px-1.5 py-0.5 rounded hover:bg-bg-tertiary"
              title="Unhide"
            >
              <Eye size={12} />
            </button>
          ) : (
            <button
              onClick={() => onHide(pr.id)}
              className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg-primary transition-colors px-1.5 py-0.5 rounded hover:bg-bg-tertiary"
              title="Hide"
            >
              <EyeOff size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
