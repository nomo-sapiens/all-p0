# AllP0

A macOS desktop app for managing GitHub pull requests. Built with Tauri v2, React, and TypeScript.

AllP0 gives you a single window to track both your own open PRs and PRs waiting for your review — without context-switching to the browser.

---

## Features

- **Two-pane layout** — your open PRs on the left, PRs assigned for your review on the right
- **Paste any GitHub PR URL** to add it to your review queue manually
- **Group PRs by repository** so you can see at a glance which repos need attention
- **Hide PRs** you don't want to see right now, and bring them back anytime
- **Auto-refreshes every 30 seconds** — no manual polling needed
- **Dark mode with indigo accent theme**
- **macOS native desktop app** via Tauri v2 (no Electron, no browser tab)

---

## Prerequisites

- macOS (the only supported platform)
- [Rust](https://rustup.rs/) stable toolchain
- Node.js 18+
- [GitHub CLI](https://cli.github.com/) authenticated: `gh auth login`

---

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/your-username/all-p0.git
cd all-p0
npm install

# 2. Authenticate with GitHub CLI (if you haven't already)
gh auth login

# 3. Run in development mode with hot reload
npm run tauri dev
```

The app window opens automatically. If you see a "Not authenticated" error, run `gh auth login` and restart.

---

## Layout

The app is a single window split into two panes:

**Left pane — Your PRs**: Lists every open PR you authored, grouped by repository. Each row shows the PR title, status checks, draft state, and how long ago it was updated.

**Right pane — Review Queue**: Lists PRs where you're a requested reviewer, plus any PRs you've manually added via URL paste. These are also grouped by repo. PRs you've hidden are collapsed and can be restored from a "hidden" section at the bottom.

The toolbar has a refresh button (also fires automatically every 30 seconds) and a URL input for pasting in a PR you want to track.

---

## Configuration

No config files. The app reads your GitHub token directly from `gh auth token` at startup. As long as `gh auth login` has been run once, AllP0 will work.

Persistent state (hidden PRs, manually-added review URLs) is stored in a JSON file in your OS app data directory (`~/Library/Application Support/com.allp0.app/` on macOS).

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full developer guide: project structure, running tests, building for distribution, architecture notes, and how to add new Tauri commands.
