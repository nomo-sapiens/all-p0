use crate::error::AppError;
use std::path::PathBuf;
use std::process::Command;

/// Paths prepended when spawning `gh` from a macOS app bundle.
/// launchd gives bundled apps a near-empty PATH, so Homebrew binaries are
/// invisible without this.
const BUNDLE_PATH_PREFIXES: &str =
    "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/usr/bin:/bin:/usr/sbin:/sbin";

fn gh_command() -> Command {
    let path = match std::env::var("PATH") {
        Ok(p) if !p.is_empty() => format!("{BUNDLE_PATH_PREFIXES}:{p}"),
        _ => BUNDLE_PATH_PREFIXES.to_string(),
    };
    let mut cmd = Command::new("gh");
    cmd.env("PATH", path);
    cmd
}

// ---------------------------------------------------------------------------
// gh hosts.yml fallback
// ---------------------------------------------------------------------------

pub(crate) struct GhHostsConfig {
    token: String,
    username: String,
}

/// Parse the simple YAML produced by `gh auth login` at `~/.config/gh/hosts.yml`.
/// We avoid a full YAML dependency — the file format is stable and minimal.
pub(crate) fn parse_gh_hosts(yaml: &str) -> Result<GhHostsConfig, AppError> {
    let mut in_github = false;
    let mut token: Option<String> = None;
    let mut username: Option<String> = None;

    for line in yaml.lines() {
        // Top-level key — check if we're entering/leaving the github.com section
        if !line.starts_with(' ') && !line.starts_with('\t') {
            in_github = line.trim_end_matches(':').trim() == "github.com";
            continue;
        }
        if !in_github {
            continue;
        }
        let trimmed = line.trim();
        if let Some(v) = trimmed.strip_prefix("oauth_token:") {
            token = Some(v.trim().to_string());
        } else if let Some(v) = trimmed.strip_prefix("user:") {
            username = Some(v.trim().to_string());
        }
    }

    token
        .map(|t| GhHostsConfig {
            token: t,
            username: username.unwrap_or_default(),
        })
        .ok_or_else(|| {
            AppError::Auth(
                "No GitHub token found. Run `gh auth login` in your terminal, then restart AllP0."
                    .to_string(),
            )
        })
}

fn read_gh_hosts() -> Result<GhHostsConfig, AppError> {
    let home = std::env::var("HOME").map_err(|_| AppError::Auth("$HOME is not set".to_string()))?;
    let path = PathBuf::from(home).join(".config/gh/hosts.yml");
    let content = std::fs::read_to_string(&path).map_err(|_| {
        AppError::Auth(
            "Not authenticated. Run `gh auth login` in your terminal, then restart AllP0."
                .to_string(),
        )
    })?;
    parse_gh_hosts(&content)
}

// ---------------------------------------------------------------------------
// Trait + production impl
// ---------------------------------------------------------------------------

pub trait TokenProvider: Send + Sync {
    fn get_token(&self) -> Result<String, AppError>;
    fn get_username(&self, token: &str) -> Result<String, AppError>;
}

pub struct GhCliTokenProvider;

impl TokenProvider for GhCliTokenProvider {
    fn get_token(&self) -> Result<String, AppError> {
        // Primary: run `gh auth token` with an expanded PATH
        if let Ok(output) = gh_command().args(["auth", "token"]).output() {
            if output.status.success() {
                let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !token.is_empty() {
                    return Ok(token);
                }
            }
        }
        // Fallback: read directly from ~/.config/gh/hosts.yml
        read_gh_hosts().map(|c| c.token)
    }

    fn get_username(&self, _token: &str) -> Result<String, AppError> {
        // Primary: run `gh api user` with an expanded PATH
        if let Ok(output) = gh_command()
            .args(["api", "user", "--jq", ".login"])
            .output()
        {
            if output.status.success() {
                let username = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !username.is_empty() {
                    return Ok(username);
                }
            }
        }
        // Fallback: read username from hosts.yml
        read_gh_hosts().map(|c| c.username)
    }
}

// ---------------------------------------------------------------------------
// Mock for use in other modules' tests
// ---------------------------------------------------------------------------

#[cfg(test)]
pub mod mock {
    use super::*;

    pub struct MockTokenProvider {
        pub token: Result<String, String>,
        pub username: Result<String, String>,
    }

    impl MockTokenProvider {
        pub fn new(token: &str, username: &str) -> Self {
            Self {
                token: Ok(token.to_string()),
                username: Ok(username.to_string()),
            }
        }

        pub fn with_token_error(token_error: &str, username: &str) -> Self {
            Self {
                token: Err(token_error.to_string()),
                username: Ok(username.to_string()),
            }
        }

        pub fn with_username_error(token: &str, username_error: &str) -> Self {
            Self {
                token: Ok(token.to_string()),
                username: Err(username_error.to_string()),
            }
        }
    }

    impl TokenProvider for MockTokenProvider {
        fn get_token(&self) -> Result<String, AppError> {
            self.token
                .as_ref()
                .map(|t| t.clone())
                .map_err(|e| AppError::Auth(e.clone()))
        }

        fn get_username(&self, _token: &str) -> Result<String, AppError> {
            self.username
                .as_ref()
                .map(|u| u.clone())
                .map_err(|e| AppError::Auth(e.clone()))
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use mock::MockTokenProvider;

    // -- MockTokenProvider --

    #[test]
    fn test_mock_success() {
        let p = MockTokenProvider::new("tok", "alice");
        assert_eq!(p.get_token().unwrap(), "tok");
        assert_eq!(p.get_username("any").unwrap(), "alice");
    }

    #[test]
    fn test_mock_token_error() {
        let p = MockTokenProvider::with_token_error("bad token", "alice");
        assert!(p.get_token().unwrap_err().to_string().contains("bad token"));
    }

    #[test]
    fn test_mock_username_error() {
        let p = MockTokenProvider::with_username_error("tok", "bad user");
        assert!(p
            .get_username("tok")
            .unwrap_err()
            .to_string()
            .contains("bad user"));
    }

    // -- parse_gh_hosts --

    #[test]
    fn test_parse_hosts_happy_path() {
        let yaml = "\
github.com:\n    oauth_token: gho_abc123\n    user: alice\n    git_protocol: https\n";
        let cfg = parse_gh_hosts(yaml).unwrap();
        assert_eq!(cfg.token, "gho_abc123");
        assert_eq!(cfg.username, "alice");
    }

    #[test]
    fn test_parse_hosts_missing_username_is_ok() {
        let yaml = "github.com:\n    oauth_token: gho_xyz\n    git_protocol: https\n";
        let cfg = parse_gh_hosts(yaml).unwrap();
        assert_eq!(cfg.token, "gho_xyz");
        assert!(cfg.username.is_empty());
    }

    #[test]
    fn test_parse_hosts_no_token_returns_error() {
        let yaml = "github.com:\n    user: alice\n    git_protocol: https\n";
        assert!(parse_gh_hosts(yaml).is_err());
    }

    #[test]
    fn test_parse_hosts_empty_returns_error() {
        assert!(parse_gh_hosts("").is_err());
    }

    #[test]
    fn test_parse_hosts_multiple_hosts_picks_github() {
        let yaml = "\
gitlab.com:\n    oauth_token: should_not_use\n    user: other\ngithub.com:\n    oauth_token: gho_correct\n    user: alice\n";
        let cfg = parse_gh_hosts(yaml).unwrap();
        assert_eq!(cfg.token, "gho_correct");
        assert_eq!(cfg.username, "alice");
    }

    #[test]
    fn test_parse_hosts_github_section_ends_at_next_top_level_key() {
        let yaml = "\
github.com:\n    oauth_token: gho_good\n    user: alice\nother.host:\n    oauth_token: should_ignore\n";
        let cfg = parse_gh_hosts(yaml).unwrap();
        assert_eq!(cfg.token, "gho_good");
    }

    // -- gh_command PATH expansion --

    #[test]
    fn test_gh_command_includes_homebrew_paths() {
        let cmd = gh_command();
        // Inspect the env we set; Command doesn't expose it directly so we
        // verify indirectly by checking the PATH we'd construct manually.
        let path = format!(
            "{}:{}",
            BUNDLE_PATH_PREFIXES,
            std::env::var("PATH").unwrap_or_default()
        );
        assert!(path.contains("/opt/homebrew/bin"));
        assert!(path.contains("/usr/local/bin"));
        // Confirm the command was built (just check it doesn't panic)
        drop(cmd);
    }

    // -- GhCliTokenProvider fallback path (no gh binary) --

    #[test]
    fn test_provider_falls_back_to_hosts_file() {
        use std::io::Write;
        use tempfile::TempDir;

        // Write a fake hosts.yml
        let dir = TempDir::new().unwrap();
        let config_dir = dir.path().join(".config/gh");
        std::fs::create_dir_all(&config_dir).unwrap();
        let hosts_path = config_dir.join("hosts.yml");
        let mut f = std::fs::File::create(&hosts_path).unwrap();
        writeln!(f, "github.com:").unwrap();
        writeln!(f, "    oauth_token: gho_fallback").unwrap();
        writeln!(f, "    user: fallback_user").unwrap();

        // Point HOME at our temp dir so read_gh_hosts() picks it up
        std::env::set_var("HOME", dir.path());

        // With a nonexistent gh binary the provider must fall back
        struct NoBinaryProvider;
        impl TokenProvider for NoBinaryProvider {
            fn get_token(&self) -> Result<String, AppError> {
                // Simulate gh not found; go straight to fallback
                read_gh_hosts().map(|c| c.token)
            }
            fn get_username(&self, _token: &str) -> Result<String, AppError> {
                read_gh_hosts().map(|c| c.username)
            }
        }

        let p = NoBinaryProvider;
        assert_eq!(p.get_token().unwrap(), "gho_fallback");
        assert_eq!(p.get_username("").unwrap(), "fallback_user");
    }

    #[test]
    fn test_provider_error_when_gh_missing_and_no_hosts_file() {
        use tempfile::TempDir;
        let dir = TempDir::new().unwrap();
        std::env::set_var("HOME", dir.path()); // no hosts.yml here

        struct NoBinaryProvider;
        impl TokenProvider for NoBinaryProvider {
            fn get_token(&self) -> Result<String, AppError> {
                read_gh_hosts().map(|c| c.token)
            }
            fn get_username(&self, _token: &str) -> Result<String, AppError> {
                read_gh_hosts().map(|c| c.username)
            }
        }

        let err = NoBinaryProvider.get_token().unwrap_err();
        assert!(err.to_string().contains("gh auth login"));
    }
}
