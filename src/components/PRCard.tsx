import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ExternalLink, Pin } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { openInBrowser } from '@/lib/api';
import {
  ReviewDecisionBadge,
  MergeableBadge,
  ChecksStatusBadge,
  DraftBadge,
} from './StatusBadge';
import type { PullRequest, Pane, Priority } from '@/types';

interface PRCardProps {
  pr: PullRequest;
  pane: Pane;
  isHidden: boolean;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  priority?: Priority;
  onSetPriority: (priority: Priority | null) => void;
}

const PRIORITY_CONFIG: Record<
  Priority,
  { textClass: string; borderClass: string; label: string }
> = {
  0: { textClass: 'text-danger', borderClass: 'border-danger/40', label: 'P0' },
  1: { textClass: 'text-warning', borderClass: 'border-warning/40', label: 'P1' },
  2: { textClass: 'text-accent-text', borderClass: 'border-accent/40', label: 'P2' },
  3: { textClass: 'text-fg-muted', borderClass: 'border-border', label: 'P3' },
};

function PrioritySelector({
  priority,
  onSetPriority,
}: {
  priority?: Priority;
  onSetPriority: (priority: Priority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const config = priority !== undefined ? PRIORITY_CONFIG[priority] : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium border transition-colors hover:opacity-80',
          config
            ? `${config.textClass} ${config.borderClass}`
            : 'text-fg-muted border-border'
        )}
        title="Set priority"
        aria-label="Set priority"
      >
        {config ? config.label : '—'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-bg-secondary border border-border rounded-lg shadow-lg py-1 min-w-[80px]">
          {([0, 1, 2, 3] as Priority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetPriority(p);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-bg-tertiary',
                  cfg.textClass
                )}
              >
                {cfg.label}
              </button>
            );
          })}
          {priority !== undefined && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetPriority(null);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-fg-muted transition-colors hover:bg-bg-tertiary border-t border-border mt-1 pt-1.5"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PRCard({ pr, isHidden, onHide, onUnhide, priority, onSetPriority }: PRCardProps) {
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
          <PrioritySelector priority={priority} onSetPriority={onSetPriority} />
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
