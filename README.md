# AllP0

A macOS desktop app for managing GitHub pull requests. Built with Tauri v2, React, and TypeScript.

AllP0 gives you a single window to track both your own open PRs and PRs waiting for your review — without context-switching to the browser.

---

## Features

- **Two-pane layout** — your open PRs on the left, PRs assigned for your review on the right
- **Paste any GitHub PR URL** to add it to your review queue manually
- **Priority labels (P0–P3)** — tag any PR with a priority; P0 is red/critical, P3 is grey/low
- **Sort by updated, created, or priority** — per pane, independently
- **Group PRs by repository** so you can see at a glance which repos need attention
- **Filter the review queue by author or project** — cut down noise when you only care about specific teams or repos
- **Hide PRs** you don't want to see right now, and bring them back anytime
- **Auto-refreshes every 30 seconds** — no manual polling needed
- **Dark mode with indigo accent theme**
- **macOS native desktop app** via Tauri v2 (no Electron, no browser tab)

---

## Prerequisites

- macOS (the only supported platform)
- [Rust](https://rustup.rs/) stable toolchain
- Node.js 18+ with [pnpm](https://pnpm.io/installation) (`npm i -g pnpm`)
- [GitHub CLI](https://cli.github.com/) authenticated: `gh auth login`

---

## Getting Started

### 1. Authenticate with GitHub CLI

AllP0 uses your existing `gh` login — no separate token setup needed.

```bash
gh auth login   # skip if already authenticated
```

### 2. Build and install

```bash
git clone https://github.com/your-username/all-p0.git
cd all-p0
pnpm install
pnpm build
```

The built app and a `.dmg` installer are placed in:
```
src-tauri/target/release/bundle/macos/
```

Open the `.dmg`, drag **AllP0.app** to your Applications folder, and launch it.

> **First launch on macOS:** because the app is not yet notarized, macOS may block it. Right-click the app → **Open** → **Open** to allow it, or run:
> ```bash
> xattr -dr com.apple.quarantine /Applications/AllP0.app
> ```
> You only need to do this once.

### For developers

To run with hot reload instead of building:

```bash
pnpm dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full developer guide.

---

## Layout

The app is a single window split into two panes:

**Left pane — Your PRs**: Lists every open PR you authored. Each card shows the title, author, approval count, CI check status, draft state, mergeable state, labels, and last-updated time.

**Right pane — Review Queue**: Lists PRs where you're a requested reviewer, plus any PRs you've manually added by pasting a GitHub PR URL. A filter button lets you narrow the list by author or project (repo) — useful when you're requested on many PRs but only want to focus on specific teams.

Both panes share the same controls in their header:
- **Sort** — choose between *Updated*, *Created*, or *Priority*
- **Group by repo** — toggle to collapse PRs under their repository header, with a clickable link to open the repo
- **Hidden count** — shows how many PRs are hidden; click to reveal and restore them

**Priority (P0–P3)**: Each PR card has a small priority button. Click it to assign P0 (red, critical) through P3 (grey, low). Priorities persist across restarts and drive the *Priority* sort order. When sorting by priority, unset PRs appear last.

The header bar shows your GitHub username, a manual refresh button, and a "last refreshed X seconds ago" counter.

---

## Configuration

No config files. The app reads your GitHub token directly from `gh auth token` at startup. As long as `gh auth login` has been run once, AllP0 will work.

Persistent state (hidden PRs, manually-added review URLs, PR priorities) is stored in a JSON file in your OS app data directory (`~/Library/Application Support/com.allp0.app/` on macOS). Review queue filters are stored in the app's local storage and persist across restarts.

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full guide: project structure, running tests, architecture notes, and how to add new commands.
