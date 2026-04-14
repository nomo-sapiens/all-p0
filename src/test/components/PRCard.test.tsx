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
    onSetPriority: vi.fn(),
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

  describe('priority selector', () => {
    it('shows "—" when no priority is set', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} />);
      expect(screen.getByTitle('Set priority')).toHaveTextContent('—');
    });

    it('shows P0 label when priority is 0', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={0} />);
      expect(screen.getByTitle('Set priority')).toHaveTextContent('P0');
    });

    it('shows P1 label when priority is 1', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={1} />);
      expect(screen.getByTitle('Set priority')).toHaveTextContent('P1');
    });

    it('shows P2 label when priority is 2', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={2} />);
      expect(screen.getByTitle('Set priority')).toHaveTextContent('P2');
    });

    it('shows P3 label when priority is 3', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={3} />);
      expect(screen.getByTitle('Set priority')).toHaveTextContent('P3');
    });

    it('opens dropdown when priority button is clicked', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Set priority'));
      expect(screen.getByText('P0')).toBeInTheDocument();
      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('P2')).toBeInTheDocument();
      expect(screen.getByText('P3')).toBeInTheDocument();
    });

    it('calls onSetPriority with correct priority when option is clicked', () => {
      const onSetPriority = vi.fn();
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} onSetPriority={onSetPriority} />);
      fireEvent.click(screen.getByTitle('Set priority'));
      fireEvent.click(screen.getByText('P2'));
      expect(onSetPriority).toHaveBeenCalledWith(2);
    });

    it('shows Clear option when priority is already set', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={1} />);
      fireEvent.click(screen.getByTitle('Set priority'));
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('does not show Clear option when no priority is set', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} />);
      fireEvent.click(screen.getByTitle('Set priority'));
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('calls onSetPriority with null when Clear is clicked', () => {
      const onSetPriority = vi.fn();
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={1} onSetPriority={onSetPriority} />);
      fireEvent.click(screen.getByTitle('Set priority'));
      fireEvent.click(screen.getByText('Clear'));
      expect(onSetPriority).toHaveBeenCalledWith(null);
    });

    it('P0 button has danger color class', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={0} />);
      const btn = screen.getByTitle('Set priority');
      expect(btn).toHaveClass('text-danger');
    });

    it('P1 button has warning color class', () => {
      const pr = makePR();
      renderWithClient(<PRCard pr={pr} {...defaultProps} priority={1} />);
      const btn = screen.getByTitle('Set priority');
      expect(btn).toHaveClass('text-warning');
    });
  });
});
