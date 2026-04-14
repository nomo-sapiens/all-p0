# AllP0 — Developer Guide

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust + system WebView) |
| Frontend framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (dark theme, indigo accents) |
| Data fetching | TanStack Query v5 |
| Icons | lucide-react |
| Tauri bridge | `@tauri-apps/api` v2 |
| Rust HTTP | reqwest 0.12 (rustls, no OpenSSL) |
| Rust testing | cargo test + wiremock + cargo-tarpaulin |
| Frontend testing | Vitest + Testing Library |

---

## Project Structure

```
all-p0/
├── src/                        # React frontend
│   ├── components/             # UI components
│   ├── hooks/                  # TanStack Query hooks
│   ├── lib/                    # api.ts (Tauri invoke wrappers), utils
│   ├── types/                  # Shared TypeScript types
│   └── test/                   # Frontend test helpers / setup
├── src-tauri/
│   ├── src/
│   │   ├── auth/               # Reads token from `gh auth token`
│   │   ├── github/             # GitHub API client (reqwest)
│   │   ├── store/              # Persistent JSON state (hidden PRs, manual list)
│   │   ├── commands/           # Tauri command handlers (thin wrappers only)
│   │   ├── error.rs            # Unified AppError type
│   │   └── lib.rs              # tauri::generate_handler! registration
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts
```

The key architectural boundary: the `commands/` handlers are kept thin (validate input, call into `github/` or `store/`, return result). Business logic lives in pure functions elsewhere so it can be unit-tested without spinning up a Tauri context.

---

## Running Locally

```bash
pnpm dev
```

This starts the Vite dev server, waits for it, then opens the native Tauri window. React hot-module replacement works normally — edits to `src/` reflect immediately. Changes to `src-tauri/src/` trigger a Rust recompile and app restart.

---

## Running Tests

### Rust backend

```bash
# Standard test run
pnpm test:backend
# equivalent: cd src-tauri && cargo test

# With HTML coverage report (requires cargo-tarpaulin)
pnpm test:coverage
# equivalent: cd src-tauri && cargo tarpaulin --out Html
# Output: tarpaulin-report.html (open in browser)
```

Install tarpaulin once:
```bash
cargo install cargo-tarpaulin
```

The backend targets 100% line coverage. `wiremock` is used to mock GitHub API responses in integration tests; `tempfile` provides throwaway directories for store tests.

### Frontend

```bash
pnpm test:frontend
# equivalent: vitest run
```

Tests live alongside components in `src/` or under `src/test/`. The Vitest config uses jsdom.

### TypeScript type check

```bash
pnpm exec tsc --noEmit
```

Run this before opening a PR — the CI enforces it.

### Lint

```bash
pnpm lint
# eslint src --ext ts,tsx --max-warnings 0
```

Zero warnings allowed; the CI will fail if any are present.

---

## Building for Distribution

### Step 1 — Icons (required before any release build)

The bundle config points to `src-tauri/icons/icon.png`. You need to generate all the required sizes from a single high-resolution source:

```bash
# Provide a 1024x1024 PNG
pnpm tauri icon path/to/your-icon-1024.png
# Writes all required sizes to src-tauri/icons/
```

Without this, `tauri build` will error on missing icon files.

### Step 2 — Install `create-dmg` (macOS, one-time)

Tauri's DMG bundler requires this Homebrew tool:

```bash
brew install create-dmg
```

### Step 3 — Release build

```bash
pnpm build
# Output: src-tauri/target/release/bundle/
#   macOS:  macos/AllP0.app  and  macos/AllP0.dmg
```

The debug build used in CI (`pnpm build -- --debug`) skips optimizations and is significantly faster.

### Step 3 — Code signing (for distribution outside the App Store)

Set these environment variables before running `tauri build`:

```bash
# Developer ID certificate (exported as .p12, base64-encoded)
APPLE_CERTIFICATE=<base64-of-your-.p12>
APPLE_CERTIFICATE_PASSWORD=<p12-password>
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"

# Notarization (required for Gatekeeper to pass on other machines)
APPLE_ID=you@example.com
APPLE_PASSWORD=<app-specific-password>
APPLE_TEAM_ID=<10-char-team-id>
```

Tauri handles the `codesign` and `xcrun notarytool` calls automatically when these are present.

### Step 4 — Releases

Tag the commit with `v*` (e.g. `v1.0.0`). The CI workflow does not automatically publish builds yet — create the release manually via `gh release create` and attach the `.dmg` from the build output.

---

## Architecture Notes

### Command boundary

Tauri commands in `src-tauri/src/commands/` are registered in `lib.rs` via `tauri::generate_handler![]`. Each command handler should do as little as possible: call into `github/` or `store/`, map the error, and return. This keeps them out of unit tests.

### Authentication

At startup, the app shells out to `gh auth token` (via `std::process::Command` in `auth/`). The token is cached in memory for the lifetime of the process. If the command fails or returns an empty string, every GitHub API call returns an `AppError::NotAuthenticated`, which the frontend surfaces as a banner prompting the user to run `gh auth login`.

### Persistent state

`tauri-plugin-store` is used to persist:
- The list of manually-added PR URLs
- The set of hidden PR node IDs

The store file lives at the OS app data directory: `~/Library/Application Support/com.allp0.app/store.json` on macOS. It is written on every mutation; reads happen at startup.

### Frontend data flow

TanStack Query hooks in `src/hooks/` call `invoke()` wrappers from `src/lib/api.ts`. Each query has `refetchInterval: 30_000`. The manual refresh button calls `queryClient.invalidateQueries()` to force an immediate refetch without waiting for the interval.

---

## Adding New Tauri Commands

1. Write the logic as a pure function in the appropriate module under `src-tauri/src/` (e.g. `github/` for API calls, `store/` for persistence). Write tests there.
2. Add a thin command handler in `src-tauri/src/commands/` that calls your function and maps errors.
3. Register the command in `tauri::generate_handler![]` in `src-tauri/src/lib.rs`.
4. Add the TypeScript `invoke` wrapper in `src/lib/api.ts` with proper typing.
5. Write a Vitest test for any hook or component that calls the new command (mock `@tauri-apps/api/core`).

---

## Troubleshooting

**"Not authenticated" error on startup**
Run `gh auth login` and restart the app. The token is only read at launch.

**Build fails: missing icon files**
Run `pnpm tauri icon path/to/icon.png` with a 1024x1024 source image first.

**`cargo check` or `cargo test` fails immediately**
Make sure Rust stable is installed and up to date: `rustup update stable`. Also check that you're running from the repo root (the `pnpm` scripts handle the `cd src-tauri` for you).

**Vite dev server port conflict**
The Tauri dev config expects Vite on `http://localhost:1420`. If something else is using that port, kill it or change `devUrl` in `src-tauri/tauri.conf.json` and the Vite config to match.

**Hot reload not working for Rust changes**
Expected — Rust recompiles require a full app restart. Tauri handles this automatically during `tauri dev`.
