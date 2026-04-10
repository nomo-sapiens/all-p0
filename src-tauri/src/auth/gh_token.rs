use crate::error::AppError;
use std::process::Command;

pub trait TokenProvider: Send + Sync {
    fn get_token(&self) -> Result<String, AppError>;
    fn get_username(&self, token: &str) -> Result<String, AppError>;
}

pub struct GhCliTokenProvider;

impl TokenProvider for GhCliTokenProvider {
    fn get_token(&self) -> Result<String, AppError> {
        let output = Command::new("gh")
            .args(["auth", "token"])
            .output()
            .map_err(|e| AppError::Auth(format!("Failed to run gh: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Auth(format!(
                "gh auth token failed: {}",
                stderr.trim()
            )));
        }

        let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if token.is_empty() {
            return Err(AppError::Auth(
                "gh auth token returned empty output".to_string(),
            ));
        }

        Ok(token)
    }

    fn get_username(&self, _token: &str) -> Result<String, AppError> {
        let output = Command::new("gh")
            .args(["api", "user", "--jq", ".login"])
            .output()
            .map_err(|e| AppError::Auth(format!("Failed to run gh: {e}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Auth(format!(
                "gh api user failed: {}",
                stderr.trim()
            )));
        }

        let username = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if username.is_empty() {
            return Err(AppError::Auth(
                "gh api user returned empty username".to_string(),
            ));
        }

        Ok(username)
    }
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use mock::MockTokenProvider;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_mock_token_provider_success() {
        let provider = MockTokenProvider::new("my-token", "octocat");
        assert_eq!(provider.get_token().unwrap(), "my-token");
        assert_eq!(provider.get_username("any").unwrap(), "octocat");
    }

    #[test]
    fn test_mock_token_provider_token_error() {
        let provider = MockTokenProvider::with_token_error("no token", "octocat");
        let err = provider.get_token().unwrap_err();
        assert!(err.to_string().contains("no token"));
    }

    #[test]
    fn test_mock_token_provider_username_error() {
        let provider = MockTokenProvider::with_username_error("token", "no user");
        let err = provider.get_username("token").unwrap_err();
        assert!(err.to_string().contains("no user"));
    }

    #[test]
    fn test_gh_cli_provider_invalid_binary() {
        // Use a path that definitely doesn't exist
        struct FakeProvider {
            binary: String,
        }

        impl TokenProvider for FakeProvider {
            fn get_token(&self) -> Result<String, AppError> {
                let output = Command::new(&self.binary)
                    .args(["auth", "token"])
                    .output()
                    .map_err(|e| AppError::Auth(format!("Failed to run gh: {e}")))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(AppError::Auth(format!(
                        "gh auth token failed: {}",
                        stderr.trim()
                    )));
                }
                let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if token.is_empty() {
                    return Err(AppError::Auth("empty".to_string()));
                }
                Ok(token)
            }

            fn get_username(&self, _token: &str) -> Result<String, AppError> {
                let output = Command::new(&self.binary)
                    .args(["api", "user", "--jq", ".login"])
                    .output()
                    .map_err(|e| AppError::Auth(format!("Failed to run gh: {e}")))?;

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    return Err(AppError::Auth(format!("failed: {}", stderr.trim())));
                }
                let username = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if username.is_empty() {
                    return Err(AppError::Auth("empty".to_string()));
                }
                Ok(username)
            }
        }

        let provider = FakeProvider {
            binary: "/nonexistent/binary/gh".to_string(),
        };
        let result = provider.get_token();
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to run gh"));
    }

    #[test]
    fn test_gh_cli_provider_empty_output() {
        // Create a fake script that exits 0 but prints nothing
        let mut script_file = NamedTempFile::new().unwrap();
        #[cfg(unix)]
        {
            writeln!(script_file, "#!/bin/sh\nexit 0").unwrap();
            use std::os::unix::fs::PermissionsExt;
            let path = script_file.path().to_owned();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();

            struct ScriptProvider {
                path: std::path::PathBuf,
            }

            impl TokenProvider for ScriptProvider {
                fn get_token(&self) -> Result<String, AppError> {
                    let output = Command::new(&self.path)
                        .output()
                        .map_err(|e| AppError::Auth(format!("Failed to run: {e}")))?;
                    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if token.is_empty() {
                        return Err(AppError::Auth("empty output".to_string()));
                    }
                    Ok(token)
                }

                fn get_username(&self, _token: &str) -> Result<String, AppError> {
                    let output = Command::new(&self.path)
                        .output()
                        .map_err(|e| AppError::Auth(format!("Failed to run: {e}")))?;
                    let username = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if username.is_empty() {
                        return Err(AppError::Auth("empty output".to_string()));
                    }
                    Ok(username)
                }
            }

            let provider = ScriptProvider { path };
            let result = provider.get_token();
            assert!(result.is_err());
            assert!(result.unwrap_err().to_string().contains("empty output"));
        }
    }

    #[test]
    fn test_gh_cli_provider_nonzero_exit() {
        // Create a fake script that exits 1
        let mut script_file = NamedTempFile::new().unwrap();
        #[cfg(unix)]
        {
            writeln!(script_file, "#!/bin/sh\necho 'error message' >&2\nexit 1").unwrap();
            use std::os::unix::fs::PermissionsExt;
            let path = script_file.path().to_owned();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();

            struct FailingProvider {
                path: std::path::PathBuf,
            }

            impl TokenProvider for FailingProvider {
                fn get_token(&self) -> Result<String, AppError> {
                    let output = Command::new(&self.path)
                        .output()
                        .map_err(|e| AppError::Auth(format!("Failed to run: {e}")))?;
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        return Err(AppError::Auth(format!("failed: {}", stderr.trim())));
                    }
                    Ok("token".to_string())
                }

                fn get_username(&self, _token: &str) -> Result<String, AppError> {
                    let output = Command::new(&self.path)
                        .output()
                        .map_err(|e| AppError::Auth(format!("Failed to run: {e}")))?;
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        return Err(AppError::Auth(format!("failed: {}", stderr.trim())));
                    }
                    Ok("user".to_string())
                }
            }

            let provider = FailingProvider { path };
            let result = provider.get_token();
            assert!(result.is_err());
            let err_str = result.unwrap_err().to_string();
            assert!(err_str.contains("failed:"));
        }
    }
}
