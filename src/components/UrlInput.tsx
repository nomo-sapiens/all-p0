import { useState, type KeyboardEvent } from 'react';
import { Plus, Loader2, CheckCircle } from 'lucide-react';
import { cn, parseGitHubPrUrl } from '@/lib/utils';
import { useAddPrByUrl } from '@/hooks/usePRs';

export function UrlInput() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { mutate: addPr, isPending } = useAddPrByUrl();

  const validate = (url: string): boolean => {
    const parsed = parseGitHubPrUrl(url);
    if (!parsed) {
      setError('Please enter a valid GitHub PR URL (e.g. https://github.com/owner/repo/pull/123)');
      return false;
    }
    setError(null);
    return true;
  };

  const handleBlur = () => {
    if (value.trim()) {
      validate(value);
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!validate(trimmed)) return;

    addPr(trimmed, {
      onSuccess: () => {
        setValue('');
        setError(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Failed to add PR';
        setError(message);
      },
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Paste GitHub PR URL..."
            disabled={isPending}
            className={cn(
              'w-full bg-bg-tertiary border rounded-md px-3 py-1.5 text-sm text-fg-primary placeholder-fg-muted',
              'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
              error ? 'border-danger' : 'border-border'
            )}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending || !value.trim()}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'bg-accent hover:bg-accent-hover text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : success ? (
            <CheckCircle size={14} />
          ) : (
            <Plus size={14} />
          )}
          <span>Add</span>
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-danger">{error}</p>
      )}

      {success && !error && (
        <p className="mt-1.5 text-xs text-success">PR added successfully!</p>
      )}
    </div>
  );
}
