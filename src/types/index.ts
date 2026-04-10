export interface PullRequest {
  id: string; // "owner/repo#number"
  number: number;
  title: string;
  url: string;
  repo: string; // "owner/repo"
  repoUrl: string;
  author: string;
  authorAvatar: string;
  approvals: number;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  checksStatus: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'NEUTRAL' | null;
  isManual: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  username: string | null;
}

export type Pane = 'mine' | 'review';
