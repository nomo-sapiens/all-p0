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
    // Each repo name appears in both the group header and the PR card meta row
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
});
