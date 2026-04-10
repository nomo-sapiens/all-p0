import { ShieldAlert } from 'lucide-react';

export function AuthError() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
      <ShieldAlert
        size={64}
        className="text-accent mb-6"
        strokeWidth={1.5}
      />
      <h1 className="text-2xl font-bold text-fg-primary mb-3">
        GitHub authentication required
      </h1>
      <p className="text-fg-secondary mb-6 max-w-md">
        AllP0 uses the GitHub CLI to fetch your pull requests. Please
        authenticate and restart the app.
      </p>
      <div className="bg-bg-tertiary border border-border rounded-lg px-6 py-4 font-mono text-sm text-accent-text">
        gh auth login
      </div>
      <p className="text-fg-muted text-sm mt-4">
        Run this command in your terminal, then restart AllP0.
      </p>
    </div>
  );
}
