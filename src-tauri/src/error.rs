use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("GitHub API error: {0}")]
    GitHub(String),
    #[error("Authentication error: {0}")]
    Auth(String),
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_error_display() {
        let e = AppError::GitHub("rate limited".to_string());
        assert_eq!(e.to_string(), "GitHub API error: rate limited");
    }

    #[test]
    fn test_auth_error_display() {
        let e = AppError::Auth("no token".to_string());
        assert_eq!(e.to_string(), "Authentication error: no token");
    }

    #[test]
    fn test_invalid_url_error_display() {
        let e = AppError::InvalidUrl("not-a-url".to_string());
        assert_eq!(e.to_string(), "Invalid URL: not-a-url");
    }

    #[test]
    fn test_json_error_display() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let e = AppError::Json(json_err);
        assert!(e.to_string().starts_with("JSON error:"));
    }

    #[test]
    fn test_io_error_display() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let e = AppError::Io(io_err);
        assert!(e.to_string().starts_with("IO error:"));
    }

    #[test]
    fn test_from_app_error_for_string() {
        let e = AppError::GitHub("some error".to_string());
        let s: String = e.into();
        assert_eq!(s, "GitHub API error: some error");
    }

    #[test]
    fn test_from_app_error_auth_for_string() {
        let e = AppError::Auth("auth failed".to_string());
        let s: String = e.into();
        assert_eq!(s, "Authentication error: auth failed");
    }

    #[test]
    fn test_from_app_error_invalid_url_for_string() {
        let e = AppError::InvalidUrl("bad-url".to_string());
        let s: String = e.into();
        assert_eq!(s, "Invalid URL: bad-url");
    }
}
