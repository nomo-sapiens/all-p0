import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Circle, AlertTriangle } from 'lucide-react';
import { useAuthStatus } from '@/hooks/usePRs';
import { Pane } from '@/components/Pane';
import { AuthError } from '@/components/AuthError';
import { cn } from '@/lib/utils';

function useLastRefreshed() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setSeconds(0);
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return seconds;
}

function formatSecondsAgo(seconds: number): string {
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export function App() {
  const queryClient = useQueryClient();
  const { data: authStatus, isLoading: authLoading } = useAuthStatus();
  const secondsAgo = useLastRefreshed();

  const handleRefreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['prs'] });
  };

  // Cmd+R keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleRefreshAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAuthenticated = authStatus?.authenticated ?? true;
  const username = authStatus?.username;

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center px-4 py-3 bg-bg-secondary border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-fg-primary tracking-tight">
            All<span className="text-accent">P0</span>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Last refreshed */}
          <span className="text-xs text-fg-muted hidden sm:inline">
            Refreshed {formatSecondsAgo(secondsAgo)}
          </span>

          {/* Refresh all button */}
          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary transition-colors border border-transparent"
            title="Refresh all (Cmd+R)"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Auth status */}
          {!authLoading && (
            <div className="flex items-center gap-1.5">
              {isAuthenticated ? (
                <>
                  <Circle size={8} className="fill-success text-success" />
                  {username && (
                    <span className="text-xs text-fg-secondary">@{username}</span>
                  )}
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-danger" />
                  <span className="text-xs text-danger">Not authenticated</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      {!authLoading && !isAuthenticated ? (
        <AuthError />
      ) : (
        <div className={cn('flex flex-1 overflow-hidden', authLoading && 'opacity-50')}>
          <Pane title="My PRs" pane="mine" />
          <Pane title="To Review" pane="review" isReview />
        </div>
      )}
    </div>
  );
}
