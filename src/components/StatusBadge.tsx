import {
  CheckCircle,
  XCircle,
  Clock,
  GitMerge,
  AlertCircle,
  Loader2,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PullRequest } from '@/types';

interface ReviewDecisionBadgeProps {
  decision: PullRequest['reviewDecision'];
}

export function ReviewDecisionBadge({ decision }: ReviewDecisionBadgeProps) {
  if (!decision) return null;

  const configs = {
    APPROVED: {
      label: 'Approved',
      icon: CheckCircle,
      className: 'text-success',
    },
    CHANGES_REQUESTED: {
      label: 'Changes requested',
      icon: XCircle,
      className: 'text-danger',
    },
    REVIEW_REQUIRED: {
      label: 'Review required',
      icon: Clock,
      className: 'text-warning',
    },
  };

  const config = configs[decision];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium',
        config.className
      )}
      title={config.label}
    >
      <Icon size={12} />
      <span>{config.label}</span>
    </span>
  );
}

interface MergeableBadgeProps {
  mergeable: PullRequest['mergeable'];
}

export function MergeableBadge({ mergeable }: MergeableBadgeProps) {
  const configs = {
    MERGEABLE: {
      label: 'Mergeable',
      className: 'text-success',
      icon: <span className="inline-block w-2 h-2 rounded-full bg-success" />,
    },
    CONFLICTING: {
      label: 'Merge conflict',
      className: 'text-danger',
      icon: <GitMerge size={12} />,
    },
    UNKNOWN: {
      label: 'Merge status unknown',
      className: 'text-fg-muted',
      icon: <Minus size={12} />,
    },
  };

  const config = configs[mergeable];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        config.className
      )}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}

interface ChecksStatusBadgeProps {
  status: PullRequest['checksStatus'];
}

export function ChecksStatusBadge({ status }: ChecksStatusBadgeProps) {
  if (!status) return null;

  const configs = {
    SUCCESS: {
      label: 'Checks passed',
      icon: CheckCircle,
      className: 'text-success',
    },
    FAILURE: {
      label: 'Checks failed',
      icon: XCircle,
      className: 'text-danger',
    },
    PENDING: {
      label: 'Checks pending',
      icon: Loader2,
      className: 'text-warning animate-spin',
    },
    NEUTRAL: {
      label: 'Checks neutral',
      icon: AlertCircle,
      className: 'text-fg-muted',
    },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span
      className={cn('inline-flex items-center', config.className)}
      title={config.label}
    >
      <Icon size={12} />
    </span>
  );
}

export function DraftBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-fg-secondary border border-border">
      Draft
    </span>
  );
}
