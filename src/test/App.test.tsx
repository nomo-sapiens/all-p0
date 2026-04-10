import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { renderWithClient } from './test-utils';
import { App } from '@/App';

const mockInvoke = vi.mocked(invoke);

const mockAuthStatus = {
  authenticated: true,
  username: 'testuser',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockImplementation((command: string) => {
    switch (command) {
      case 'get_auth_status':
        return Promise.resolve(mockAuthStatus);
      case 'get_my_prs':
        return Promise.resolve([]);
      case 'get_review_prs':
        return Promise.resolve([]);
      case 'get_hidden_prs':
        return Promise.resolve([]);
      default:
        return Promise.resolve(null);
    }
  });
});

describe('App', () => {
  it('renders the AllP0 header', async () => {
    renderWithClient(<App />);
    await waitFor(() => {
      expect(screen.getByText('P0')).toBeInTheDocument();
    });
  });

  it('renders both panes', async () => {
    renderWithClient(<App />);
    await waitFor(() => {
      expect(screen.getByText('My PRs')).toBeInTheDocument();
      expect(screen.getByText('To Review')).toBeInTheDocument();
    });
  });

  it('shows auth error when not authenticated', async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'get_auth_status') {
        return Promise.resolve({ authenticated: false, username: null });
      }
      return Promise.resolve([]);
    });

    renderWithClient(<App />);
    await waitFor(() => {
      expect(
        screen.getByText('GitHub authentication required')
      ).toBeInTheDocument();
    });
  });

  it('shows username when authenticated', async () => {
    renderWithClient(<App />);
    await waitFor(() => {
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });
  });
});
