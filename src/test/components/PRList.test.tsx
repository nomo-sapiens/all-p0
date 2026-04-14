import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from '../test-utils';
import { PRList } from '@/components/PRList';
import { makePR } from '../fixtures';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
});

const defaultListProps = {
  hiddenIds: new Set<string>(),
  showHidden: false,
  pane: 'mine' as const,
  grouped: false,
  onHide: vi.fn(),
  onUnhide: vi.fn(),
  onSetPriority: vi.fn(),
};

describe('PRList', () => {
  it('renders empty state when no visible PRs', () => {
    renderWithClient(<PRList prs={[]} {...defaultListProps} />);
    expect(screen.getByText('No pull requests')).toBeInTheDocument();
  });

  it('renders empty state with mine pane message', () => {
    renderWithClient(<PRList prs={[]} {...defaultListProps} pane="mine" />);
    expect(screen.getByText('You have no open PRs right now.')).toBeInTheDocument();
  });

  it('renders empty state with review pane message', () => {
    renderWithClient(<PRList prs={[]} {...defaultListProps} pane="review" />);
    expect(screen.getByText('No PRs awaiting your review.')).toBeInTheDocument();
  });

  it('renders flat list of PRs', () => {
    const prs = [
      makePR({ id: 'owner/repo#1', title: 'PR One' }),
      makePR({ id: 'owner/repo#2', number: 2, title: 'PR Two' }),
    ];
    renderWithClient(<PRList prs={prs} {...defaultListProps} grouped={false} />);
    expect(screen.getByText('PR One')).toBeInTheDocument();
    expect(screen.getByText('PR Two')).toBeInTheDocument();
  });

  it('renders grouped list by repo', () => {
    const prs = [
      makePR({ id: 'owner/repo-a#1', repo: 'owner/repo-a', repoUrl: 'https://github.com/owner/repo-a', title: 'PR in A' }),
      makePR({ id: 'owner/repo-b#1', repo: 'owner/repo-b', repoUrl: 'https://github.com/owner/repo-b', title: 'PR in B' }),
    ];
    renderWithClient(<PRList prs={prs} {...defaultListProps} grouped={true} />);
    expect(screen.getAllByText('owner/repo-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('owner/repo-b').length).toBeGreaterThan(0);
    expect(screen.getByText('PR in A')).toBeInTheDocument();
    expect(screen.getByText('PR in B')).toBeInTheDocument();
  });

  it('filters hidden PRs when showHidden is false', () => {
    const prs = [
      makePR({ id: 'owner/repo#1', title: 'Visible' }),
      makePR({ id: 'owner/repo#2', number: 2, title: 'Hidden' }),
    ];
    const hiddenIds = new Set(['owner/repo#2']);

    renderWithClient(
      <PRList
        prs={prs}
        {...defaultListProps}
        hiddenIds={hiddenIds}
        showHidden={false}
      />
    );

    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('shows hidden PRs when showHidden is true', () => {
    const prs = [
      makePR({ id: 'owner/repo#1', title: 'Visible' }),
      makePR({ id: 'owner/repo#2', number: 2, title: 'Hidden' }),
    ];
    const hiddenIds = new Set(['owner/repo#2']);

    renderWithClient(
      <PRList
        prs={prs}
        {...defaultListProps}
        hiddenIds={hiddenIds}
        showHidden={true}
      />
    );

    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('shows empty state when all PRs are hidden and showHidden is false', () => {
    const prs = [makePR({ id: 'owner/repo#1', title: 'Hidden PR' })];
    const hiddenIds = new Set(['owner/repo#1']);

    renderWithClient(
      <PRList
        prs={prs}
        {...defaultListProps}
        hiddenIds={hiddenIds}
        showHidden={false}
      />
    );

    expect(screen.getByText('No pull requests')).toBeInTheDocument();
  });

  describe('sort order', () => {
    it('sorts by updatedAt descending (default)', () => {
      const prs = [
        makePR({ id: 'owner/repo#1', title: 'Older', updatedAt: '2024-01-01T00:00:00Z' }),
        makePR({ id: 'owner/repo#2', number: 2, title: 'Newer', updatedAt: '2024-06-01T00:00:00Z' }),
      ];
      const { container } = renderWithClient(
        <PRList prs={prs} {...defaultListProps} sortOrder="updated" />
      );
      const titles = container.querySelectorAll('button[class*="text-sm font-medium"]');
      expect(titles[0]).toHaveTextContent('Newer');
      expect(titles[1]).toHaveTextContent('Older');
    });

    it('sorts by createdAt descending', () => {
      const prs = [
        makePR({ id: 'owner/repo#1', title: 'Created First', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' }),
        makePR({ id: 'owner/repo#2', number: 2, title: 'Created Later', createdAt: '2024-05-01T00:00:00Z', updatedAt: '2024-01-15T00:00:00Z' }),
      ];
      const { container } = renderWithClient(
        <PRList prs={prs} {...defaultListProps} sortOrder="created" />
      );
      const titles = container.querySelectorAll('button[class*="text-sm font-medium"]');
      expect(titles[0]).toHaveTextContent('Created Later');
      expect(titles[1]).toHaveTextContent('Created First');
    });

    it('sorts by priority ascending, unset PRs go last', () => {
      const prs = [
        makePR({ id: 'owner/repo#3', number: 3, title: 'No Priority', updatedAt: '2024-06-01T00:00:00Z' }),
        makePR({ id: 'owner/repo#1', title: 'P2 PR', updatedAt: '2024-01-01T00:00:00Z' }),
        makePR({ id: 'owner/repo#2', number: 2, title: 'P1 PR', updatedAt: '2024-03-01T00:00:00Z' }),
      ];
      const priorities = { 'owner/repo#1': 2 as const, 'owner/repo#2': 1 as const };

      const { container } = renderWithClient(
        <PRList prs={prs} {...defaultListProps} sortOrder="priority" priorities={priorities} />
      );
      const titles = container.querySelectorAll('button[class*="text-sm font-medium"]');
      expect(titles[0]).toHaveTextContent('P1 PR');
      expect(titles[1]).toHaveTextContent('P2 PR');
      expect(titles[2]).toHaveTextContent('No Priority');
    });

    it('breaks ties in priority sort by updatedAt descending', () => {
      const prs = [
        makePR({ id: 'owner/repo#1', title: 'P1 Older', updatedAt: '2024-01-01T00:00:00Z' }),
        makePR({ id: 'owner/repo#2', number: 2, title: 'P1 Newer', updatedAt: '2024-06-01T00:00:00Z' }),
      ];
      const priorities = { 'owner/repo#1': 1 as const, 'owner/repo#2': 1 as const };

      const { container } = renderWithClient(
        <PRList prs={prs} {...defaultListProps} sortOrder="priority" priorities={priorities} />
      );
      const titles = container.querySelectorAll('button[class*="text-sm font-medium"]');
      expect(titles[0]).toHaveTextContent('P1 Newer');
      expect(titles[1]).toHaveTextContent('P1 Older');
    });

    it('sorts grouped view: groups ordered by best priority', () => {
      const prs = [
        makePR({ id: 'owner/repo-b#1', repo: 'owner/repo-b', repoUrl: 'https://github.com/owner/repo-b', title: 'PR B (P2)', updatedAt: '2024-01-01T00:00:00Z' }),
        makePR({ id: 'owner/repo-a#1', repo: 'owner/repo-a', repoUrl: 'https://github.com/owner/repo-a', title: 'PR A (P1)', updatedAt: '2024-01-01T00:00:00Z' }),
      ];
      const priorities = { 'owner/repo-b#1': 2 as const, 'owner/repo-a#1': 1 as const };

      renderWithClient(
        <PRList prs={prs} {...defaultListProps} grouped={true} sortOrder="priority" priorities={priorities} />
      );

      const allGroupTexts = screen.getAllByRole('button').map((b) => b.textContent ?? '');
      const repoAIndex = allGroupTexts.findIndex((t) => t.includes('owner/repo-a'));
      const repoBIndex = allGroupTexts.findIndex((t) => t.includes('owner/repo-b'));
      expect(repoAIndex).toBeLessThan(repoBIndex);
    });
  });
});
