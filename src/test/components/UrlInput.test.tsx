import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from '../test-utils';
import { UrlInput } from '@/components/UrlInput';
import { makePR } from '../fixtures';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UrlInput', () => {
  it('renders input with placeholder', () => {
    renderWithClient(<UrlInput />);
    expect(screen.getByPlaceholderText('Paste GitHub PR URL...')).toBeInTheDocument();
  });

  it('shows error on invalid URL blur', async () => {
    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');
    await userEvent.type(input, 'not-a-valid-url');
    fireEvent.blur(input);

    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid GitHub PR URL/i)
      ).toBeInTheDocument();
    });
  });

  it('does not show error on empty blur', () => {
    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');
    fireEvent.blur(input);
    expect(screen.queryByText(/Please enter a valid GitHub PR URL/i)).not.toBeInTheDocument();
  });

  it('calls add_pr_by_url mutation on valid URL + Enter', async () => {
    const pr = makePR();
    mockInvoke.mockResolvedValueOnce(pr);

    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');

    await userEvent.type(input, 'https://github.com/owner/repo/pull/1');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_pr_by_url', {
        url: 'https://github.com/owner/repo/pull/1',
      });
    });
  });

  it('clears input on success', async () => {
    const pr = makePR();
    mockInvoke.mockResolvedValueOnce(pr);

    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');

    await userEvent.type(input, 'https://github.com/owner/repo/pull/1');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  it('shows success message after adding', async () => {
    const pr = makePR();
    mockInvoke.mockResolvedValueOnce(pr);

    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');

    await userEvent.type(input, 'https://github.com/owner/repo/pull/1');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('PR added successfully!')).toBeInTheDocument();
    });
  });

  it('shows error message when backend rejects URL', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('PR not found'));

    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');

    await userEvent.type(input, 'https://github.com/owner/repo/pull/999');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('PR not found')).toBeInTheDocument();
    });
  });

  it('calls add_pr_by_url on Add button click', async () => {
    const pr = makePR();
    mockInvoke.mockResolvedValueOnce(pr);

    renderWithClient(<UrlInput />);
    const input = screen.getByPlaceholderText('Paste GitHub PR URL...');
    await userEvent.type(input, 'https://github.com/owner/repo/pull/1');

    const addButton = screen.getByRole('button', { name: /add/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('add_pr_by_url', {
        url: 'https://github.com/owner/repo/pull/1',
      });
    });
  });
});
