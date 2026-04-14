import { invoke } from '@tauri-apps/api/core';
import type { PullRequest, AuthStatus, Pane, Priority } from '@/types';

export const getMyPRs = (): Promise<PullRequest[]> =>
  invoke<PullRequest[]>('get_my_prs');

export const getReviewPRs = (): Promise<PullRequest[]> =>
  invoke<PullRequest[]>('get_review_prs');

export const addPrByUrl = (url: string): Promise<PullRequest> =>
  invoke<PullRequest>('add_pr_by_url', { url });

export const getAuthStatus = (): Promise<AuthStatus> =>
  invoke<AuthStatus>('get_auth_status');

export const removeFromReviewList = (id: string): Promise<void> =>
  invoke<void>('remove_from_review_list', { id });

export const getManualReviewList = (): Promise<string[]> =>
  invoke<string[]>('get_manual_review_list');

export const hidePR = (id: string, pane: Pane): Promise<void> =>
  invoke<void>('hide_pr', { id, pane });

export const unhidePR = (id: string, pane: Pane): Promise<void> =>
  invoke<void>('unhide_pr', { id, pane });

export const getHiddenPRs = (pane: Pane): Promise<string[]> =>
  invoke<string[]>('get_hidden_prs', { pane });

export const openInBrowser = (url: string): Promise<void> =>
  invoke<void>('open_in_browser', { url });

export const setPrPriority = (id: string, priority: Priority): Promise<void> =>
  invoke<void>('set_pr_priority', { id, priority });

export const clearPrPriority = (id: string): Promise<void> =>
  invoke<void>('clear_pr_priority', { id });

export const getAllPriorities = (): Promise<Record<string, Priority>> =>
  invoke<Record<string, Priority>>('get_all_priorities');
