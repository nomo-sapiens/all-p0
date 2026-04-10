import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from '../test-utils';
import { RepoGroup } from '@/components/RepoGroup';
import { makePR } from '../fixtures';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
});

const defaultGroupProps = {
  repo: 'owner/repo',
  repoUrl: 'https://github.com/owner/repo',
  hiddenIds: new Set<string>(),
  showHidden: false,
  pane: 'mine' as const,
  onHide: vi.fn(),
  onUnhide: vi.fn(),
};

describe('RepoGroup', () => {
  it('renders repo name in header', () => {
    const prs = [makePR()];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);
    // The header has the repo name; the PR card also shows repo in meta row.
    // Use getAllByText and confirm at least one instance exists.
    expect(screen.getAllByText('owner/repo').length).toBeGreaterThan(0);
  });

  it('renders correct PR count badge', () => {
    const prs = [makePR({ id: 'owner/repo#1' }), makePR({ id: 'owner/repo#2', number: 2 })];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders PR titles', () => {
    const prs = [makePR({ title: 'First PR' })];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);
    expect(screen.getByText('First PR')).toBeInTheDocument();
  });

  it('collapses when header is clicked', () => {
    const prs = [makePR({ title: 'Should hide' })];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);
    expect(screen.getByText('Should hide')).toBeInTheDocument();

    // Click the header button (the outer button)
    const headerButton = screen.getAllByRole('button')[0];
    fireEvent.click(headerButton);

    expect(screen.queryByText('Should hide')).not.toBeInTheDocument();
  });

  it('expands again after second click', () => {
    const prs = [makePR({ title: 'Toggle me' })];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);

    const headerButton = screen.getAllByRole('button')[0];
    fireEvent.click(headerButton); // collapse
    fireEvent.click(headerButton); // expand

    expect(screen.getByText('Toggle me')).toBeInTheDocument();
  });

  it('repo link button calls open_in_browser', () => {
    const prs = [makePR()];
    renderWithClient(<RepoGroup {...defaultGroupProps} prs={prs} />);
    // The first "Open repo" button in the group header opens the repo URL
    const repoLinkBtns = screen.getAllByTitle('Open repo');
    fireEvent.click(repoLinkBtns[0]);
    expect(mockInvoke).toHaveBeenCalledWith('open_in_browser', {
      url: 'https://github.com/owner/repo',
    });
  });

  it('filters hidden PRs when showHidden is false', () => {
    const pr1 = makePR({ id: 'owner/repo#1', title: 'Visible PR' });
    const pr2 = makePR({ id: 'owner/repo#2', number: 2, title: 'Hidden PR' });
    const hiddenIds = new Set(['owner/repo#2']);

    renderWithClient(
      <RepoGroup
        {...defaultGroupProps}
        prs={[pr1, pr2]}
        hiddenIds={hiddenIds}
        showHidden={false}
      />
    );

    expect(screen.getByText('Visible PR')).toBeInTheDocument();
    expect(screen.queryByText('Hidden PR')).not.toBeInTheDocument();
  });

  it('shows hidden PRs when showHidden is true', () => {
    const pr1 = makePR({ id: 'owner/repo#1', title: 'Visible PR' });
    const pr2 = makePR({ id: 'owner/repo#2', number: 2, title: 'Hidden PR' });
    const hiddenIds = new Set(['owner/repo#2']);

    renderWithClient(
      <RepoGroup
        {...defaultGroupProps}
        prs={[pr1, pr2]}
        hiddenIds={hiddenIds}
        showHidden={true}
      />
    );

    expect(screen.getByText('Visible PR')).toBeInTheDocument();
    expect(screen.getByText('Hidden PR')).toBeInTheDocument();
  });
});
