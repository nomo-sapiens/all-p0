import type { PullRequest } from '@/types';

export function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: 'owner/repo#1',
    number: 1,
    title: 'Test PR',
    url: 'https://github.com/owner/repo/pull/1',
    repo: 'owner/repo',
    repoUrl: 'https://github.com/owner/repo',
    author: 'testuser',
    authorAvatar: 'https://github.com/testuser.png',
    approvals: 0,
    reviewDecision: null,
    mergeable: 'MERGEABLE',
    isDraft: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T12:00:00Z',
    labels: [],
    checksStatus: null,
    isManual: false,
    ...overrides,
  };
}
