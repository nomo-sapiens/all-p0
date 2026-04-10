import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return isoString;
  }
}

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  number: number;
}

export function parseGitHubPrUrl(url: string): ParsedPRUrl | null {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(
      /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:[?#].*)?$/
    );
    if (!match) return null;
    const [, owner, repo, numberStr] = match;
    const number = parseInt(numberStr, 10);
    if (isNaN(number) || number <= 0) return null;
    return { owner, repo, number };
  } catch {
    return null;
  }
}
