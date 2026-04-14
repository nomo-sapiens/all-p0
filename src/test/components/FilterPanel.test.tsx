import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from '../test-utils';
import { FilterPanel } from '@/components/FilterPanel';
import { makePR } from '../fixtures';
import type { ReviewFilters } from '@/hooks/useReviewFilters';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function makeDefaultProps(overrides?: Partial<Parameters<typeof FilterPanel>[0]>) {
  return {
    allPRs: [
      makePR({ id: 'owner/repo#1', author: 'alice', repo: 'owner/repo-a', repoUrl: 'https://github.com/owner/repo-a' }),
      makePR({ id: 'owner/repo#2', number: 2, author: 'bob', repo: 'owner/repo-b', repoUrl: 'https://github.com/owner/repo-b' }),
    ],
    filters: { authors: [], repos: [] } as ReviewFilters,
    onSetFilters: vi.fn(),
    onClearFilters: vi.fn(),
    isActive: false,
    open: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('FilterPanel', () => {
  it('renders filter button', () => {
    renderWithClient(<FilterPanel {...makeDefaultProps()} />);
    expect(screen.getByTitle('Filter')).toBeInTheDocument();
  });

  it('does not show dropdown when open is false', () => {
    renderWithClient(<FilterPanel {...makeDefaultProps()} />);
    expect(screen.queryByText('Authors')).not.toBeInTheDocument();
  });

  it('shows authors and repos when open is true', () => {
    renderWithClient(<FilterPanel {...makeDefaultProps({ open: true })} />);
    expect(screen.getByText('Authors')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('owner/repo-a')).toBeInTheDocument();
    expect(screen.getByText('owner/repo-b')).toBeInTheDocument();
  });

  it('clicking toggle button calls onToggle', () => {
    const onToggle = vi.fn();
    renderWithClient(<FilterPanel {...makeDefaultProps({ onToggle })} />);
    fireEvent.click(screen.getByTitle('Filter'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('clicking author checkbox calls onSetFilters with author added', () => {
    const onSetFilters = vi.fn();
    renderWithClient(<FilterPanel {...makeDefaultProps({ open: true, onSetFilters })} />);
    const aliceCheckbox = screen.getByRole('checkbox', { name: /@alice/i });
    fireEvent.click(aliceCheckbox);
    expect(onSetFilters).toHaveBeenCalledWith({ authors: ['alice'], repos: [] });
  });

  it('clicking repo checkbox calls onSetFilters with repo added', () => {
    const onSetFilters = vi.fn();
    renderWithClient(<FilterPanel {...makeDefaultProps({ open: true, onSetFilters })} />);
    const repoCheckbox = screen.getByRole('checkbox', { name: /owner\/repo-a/i });
    fireEvent.click(repoCheckbox);
    expect(onSetFilters).toHaveBeenCalledWith({ authors: [], repos: ['owner/repo-a'] });
  });

  it('checked author shows as checked', () => {
    renderWithClient(
      <FilterPanel
        {...makeDefaultProps({
          open: true,
          filters: { authors: ['alice'], repos: [] },
          isActive: true,
        })}
      />
    );
    const aliceCheckbox = screen.getByRole('checkbox', { name: /@alice/i });
    expect(aliceCheckbox).toBeChecked();
  });

  it('unchecked author shows as unchecked', () => {
    renderWithClient(
      <FilterPanel
        {...makeDefaultProps({
          open: true,
          filters: { authors: ['alice'], repos: [] },
          isActive: true,
        })}
      />
    );
    const bobCheckbox = screen.getByRole('checkbox', { name: /@bob/i });
    expect(bobCheckbox).not.toBeChecked();
  });

  it('shows clear all filters button when isActive is true', () => {
    renderWithClient(
      <FilterPanel
        {...makeDefaultProps({
          open: true,
          isActive: true,
          filters: { authors: ['alice'], repos: [] },
        })}
      />
    );
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('does not show clear all filters button when isActive is false', () => {
    renderWithClient(<FilterPanel {...makeDefaultProps({ open: true })} />);
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('clicking clear all filters calls onClearFilters and onClose', () => {
    const onClearFilters = vi.fn();
    const onClose = vi.fn();
    renderWithClient(
      <FilterPanel
        {...makeDefaultProps({
          open: true,
          isActive: true,
          filters: { authors: ['alice'], repos: [] },
          onClearFilters,
          onClose,
        })}
      />
    );
    fireEvent.click(screen.getByText('Clear all filters'));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows active count badge when filters are active', () => {
    renderWithClient(
      <FilterPanel
        {...makeDefaultProps({
          isActive: true,
          filters: { authors: ['alice'], repos: ['owner/repo-a'] },
        })}
      />
    );
    // 2 active filters (1 author + 1 repo)
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('closes on outside click', () => {
    const onClose = vi.fn();
    renderWithClient(
      <FilterPanel {...makeDefaultProps({ open: true, onClose })} />
    );
    // Simulate click outside
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    renderWithClient(
      <FilterPanel {...makeDefaultProps({ open: true, onClose })} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('derives unique authors from allPRs', () => {
    const prs = [
      makePR({ id: 'owner/repo#1', author: 'alice' }),
      makePR({ id: 'owner/repo#2', number: 2, author: 'alice' }), // duplicate
      makePR({ id: 'owner/repo#3', number: 3, author: 'charlie' }),
    ];
    renderWithClient(<FilterPanel {...makeDefaultProps({ open: true, allPRs: prs })} />);
    const authorLabels = screen.getAllByText(/@alice|@charlie/);
    expect(authorLabels).toHaveLength(2); // alice once, charlie once
  });
});
