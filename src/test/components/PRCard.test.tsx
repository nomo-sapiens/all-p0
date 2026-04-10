import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from '../test-utils';
import { PRCard } from '@/components/PRCard';
import { makePR } from '../fixtures';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
});

describe('PRCard', () => {
  const defaultProps = {
    pane: 'mine' as const,
    isHidden: false,
    onHide: vi.fn(),
    onUnhide: vi.fn(),
  };

  it('renders PR title', () => {
    const pr = makePR({ title: 'My cool feature' });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('My cool feature')).toBeInTheDocument();
  });

  it('renders author', () => {
    const pr = makePR({ author: 'johndoe' });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('@johndoe')).toBeInTheDocument();
  });

  it('renders PR number', () => {
    const pr = makePR({ number: 42 });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('renders approvals count', () => {
    const pr = makePR({ approvals: 2 });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('2 approvals')).toBeInTheDocument();
  });

  it('renders labels', () => {
    const pr = makePR({ labels: ['bug', 'enhancement'] });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('bug')).toBeInTheDocument();
    expect(screen.getByText('enhancement')).toBeInTheDocument();
  });

  it('renders Draft badge when isDraft is true', () => {
    const pr = makePR({ isDraft: true });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows pin icon for manual PRs', () => {
    const pr = makePR({ isManual: true });
    const { container } = renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    // lucide Pin icon has a title attribute from the parent span
    const pinWrapper = container.querySelector('[title="Manually added"]');
    expect(pinWrapper).toBeInTheDocument();
  });

  it('clicking title calls open_in_browser', () => {
    const pr = makePR({ title: 'Click me', url: 'https://github.com/owner/repo/pull/1' });
    renderWithClient(<PRCard pr={pr} {...defaultProps} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(mockInvoke).toHaveBeenCalledWith('open_in_browser', {
      url: 'https://github.com/owner/repo/pull/1',
    });
  });

  it('clicking hide button calls onHide with PR id', () => {
    const onHide = vi.fn();
    const pr = makePR({ id: 'owner/repo#1' });
    renderWithClient(
      <PRCard pr={pr} {...defaultProps} onHide={onHide} isHidden={false} />
    );
    const hideBtn = screen.getByTitle('Hide');
    fireEvent.click(hideBtn);
    expect(onHide).toHaveBeenCalledWith('owner/repo#1');
  });

  it('clicking unhide button calls onUnhide with PR id when hidden', () => {
    const onUnhide = vi.fn();
    const pr = makePR({ id: 'owner/repo#1' });
    renderWithClient(
      <PRCard pr={pr} {...defaultProps} onUnhide={onUnhide} isHidden={true} />
    );
    const unhideBtn = screen.getByTitle('Unhide');
    fireEvent.click(unhideBtn);
    expect(onUnhide).toHaveBeenCalledWith('owner/repo#1');
  });

  it('hidden PR renders with opacity-50 class', () => {
    const pr = makePR();
    const { container } = renderWithClient(
      <PRCard pr={pr} {...defaultProps} isHidden={true} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('opacity-50');
  });

  it('non-hidden PR does not have opacity-50 class', () => {
    const pr = makePR();
    const { container } = renderWithClient(
      <PRCard pr={pr} {...defaultProps} isHidden={false} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveClass('opacity-50');
  });
});
