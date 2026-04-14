use crate::error::AppError;
use crate::github::client::GitHubClient;
use crate::github::types::{AuthStatus, PullRequest};
use crate::store::json_store::JsonStore;
use std::collections::HashMap;

const MANUAL_REVIEW_LIST_KEY: &str = "manual_review_list";
const PR_PRIORITIES_KEY: &str = "pr_priorities";

/// App state held in Tauri State
pub struct AppState {
    pub github_client: GitHubClient,
    pub store: JsonStore,
    pub username: String,
}

// ---- Pure business logic functions (testable without Tauri state) ----

pub async fn fetch_my_prs(
    client: &GitHubClient,
    username: &str,
) -> Result<Vec<PullRequest>, String> {
    client.get_my_prs(username).await.map_err(String::from)
}

pub async fn fetch_review_prs(
    client: &GitHubClient,
    store: &JsonStore,
    username: &str,
) -> Result<Vec<PullRequest>, String> {
    let mut prs = client
        .get_review_prs(username)
        .await
        .map_err(String::from)?;

    // Fetch manually added PRs
    let manual_ids = store.get_strings(MANUAL_REVIEW_LIST_KEY);
    for id in &manual_ids {
        // Parse id format: "owner/repo#number"
        if let Some(url) = id_to_url(id) {
            match client.get_pr_by_url(&url).await {
                Ok(mut pr) => {
                    pr.is_manual = true;
                    // Deduplicate by id
                    if !prs.iter().any(|p| p.id == pr.id) {
                        prs.push(pr);
                    }
                }
                Err(_) => {
                    // Skip PRs that can't be fetched (closed, deleted, etc.)
                }
            }
        }
    }

    Ok(prs)
}

pub async fn add_pr_by_url_logic(
    client: &GitHubClient,
    store: &JsonStore,
    url: &str,
) -> Result<PullRequest, String> {
    let mut pr = client.get_pr_by_url(url).await.map_err(String::from)?;
    pr.is_manual = true;
    store
        .push_string(MANUAL_REVIEW_LIST_KEY, pr.id.clone())
        .map_err(String::from)?;
    Ok(pr)
}

/// Convert an id like "owner/repo#42" to "https://github.com/owner/repo/pull/42"
fn id_to_url(id: &str) -> Option<String> {
    let (repo_part, number_part) = id.split_once('#')?;
    Some(format!("https://github.com/{repo_part}/pull/{number_part}"))
}

// ---- Priority business logic ----

/// Set a PR priority (0-3). Returns an error if the priority is out of range.
pub fn set_priority_impl(store: &JsonStore, id: &str, priority: u8) -> Result<(), AppError> {
    if !(0..=3).contains(&priority) {
        return Err(AppError::InvalidUrl("Priority must be 0-3".to_string()));
    }
    store.set_object_field(
        PR_PRIORITIES_KEY,
        id,
        serde_json::Value::Number(priority.into()),
    )
}

/// Remove the priority for a PR (no-op if the PR has no stored priority).
pub fn clear_priority_impl(store: &JsonStore, id: &str) -> Result<(), AppError> {
    store.remove_object_field(PR_PRIORITIES_KEY, id)
}

/// Return all stored priorities as HashMap<pr_id, priority_u8>.
/// Entries that are not valid 1-4 integers are silently skipped.
pub fn get_all_priorities_impl(store: &JsonStore) -> HashMap<String, u8> {
    store
        .get_object(PR_PRIORITIES_KEY)
        .into_iter()
        .filter_map(|(k, v)| {
            let n = v.as_u64()?;
            let p = u8::try_from(n).ok()?;
            if (0..=3).contains(&p) {
                Some((k, p))
            } else {
                None
            }
        })
        .collect()
}

// ---- Tauri commands ----

#[tauri::command]
pub async fn get_my_prs(state: tauri::State<'_, AppState>) -> Result<Vec<PullRequest>, String> {
    fetch_my_prs(&state.github_client, &state.username).await
}

#[tauri::command]
pub async fn get_review_prs(state: tauri::State<'_, AppState>) -> Result<Vec<PullRequest>, String> {
    fetch_review_prs(&state.github_client, &state.store, &state.username).await
}

#[tauri::command]
pub async fn add_pr_by_url(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<PullRequest, String> {
    add_pr_by_url_logic(&state.github_client, &state.store, &url).await
}

#[tauri::command]
pub async fn get_auth_status(state: tauri::State<'_, AppState>) -> Result<AuthStatus, String> {
    let authenticated = !state.username.is_empty();
    Ok(AuthStatus {
        authenticated,
        username: if authenticated {
            Some(state.username.clone())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn set_pr_priority(
    state: tauri::State<'_, AppState>,
    id: String,
    priority: u8,
) -> Result<(), String> {
    set_priority_impl(&state.store, &id, priority).map_err(String::from)
}

#[tauri::command]
pub async fn clear_pr_priority(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    clear_priority_impl(&state.store, &id).map_err(String::from)
}

#[tauri::command]
pub async fn get_all_priorities(
    state: tauri::State<'_, AppState>,
) -> Result<HashMap<String, u8>, String> {
    Ok(get_all_priorities_impl(&state.store))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_store() -> (JsonStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let p = dir.path().join("store.json");
        (JsonStore::new(p), dir)
    }

    fn search_response_with_pr(number: i64, title: &str, repo: &str) -> serde_json::Value {
        serde_json::json!({
            "data": {
                "search": {
                    "nodes": [{
                        "number": number,
                        "title": title,
                        "url": format!("https://github.com/{repo}/pull/{number}"),
                        "isDraft": false,
                        "mergeable": "MERGEABLE",
                        "createdAt": "2024-01-01T00:00:00Z",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "repository": {
                            "nameWithOwner": repo,
                            "url": format!("https://github.com/{repo}")
                        },
                        "author": { "login": "user", "avatarUrl": "https://example.com/avatar" },
                        "reviewDecision": null,
                        "reviews": { "totalCount": 0 },
                        "labels": { "nodes": [] },
                        "commits": { "nodes": [] }
                    }]
                }
            }
        })
    }

    fn get_pr_response(number: i64, title: &str, repo: &str) -> serde_json::Value {
        serde_json::json!({
            "data": {
                "repository": {
                    "pullRequest": {
                        "number": number,
                        "title": title,
                        "url": format!("https://github.com/{repo}/pull/{number}"),
                        "isDraft": false,
                        "mergeable": "MERGEABLE",
                        "createdAt": "2024-01-01T00:00:00Z",
                        "updatedAt": "2024-01-01T00:00:00Z",
                        "repository": {
                            "nameWithOwner": repo,
                            "url": format!("https://github.com/{repo}")
                        },
                        "author": { "login": "user", "avatarUrl": "https://example.com/avatar" },
                        "reviewDecision": null,
                        "reviews": { "totalCount": 0 },
                        "labels": { "nodes": [] },
                        "commits": { "nodes": [] }
                    }
                }
            }
        })
    }

    #[test]
    fn test_id_to_url() {
        assert_eq!(
            id_to_url("owner/repo#42"),
            Some("https://github.com/owner/repo/pull/42".to_string())
        );
    }

    #[test]
    fn test_id_to_url_invalid() {
        assert_eq!(id_to_url("no-hash-here"), None);
    }

    #[tokio::test]
    async fn test_fetch_my_prs() {
        let mock_server = MockServer::start().await;
        let body = search_response_with_pr(1, "My PR", "org/repo");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("token".to_string(), mock_server.uri());
        let prs = fetch_my_prs(&client, "user").await.unwrap();
        assert_eq!(prs.len(), 1);
        assert_eq!(prs[0].title, "My PR");
    }

    #[tokio::test]
    async fn test_fetch_review_prs_with_manual() {
        let mock_server = MockServer::start().await;

        // First call: search for review PRs - returns one PR
        let search_body = search_response_with_pr(10, "Review PR", "org/repo");
        // Second call: get manually added PR
        let get_body = get_pr_response(99, "Manual PR", "other/repo");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(search_body))
            .up_to_n_times(1)
            .mount(&mock_server)
            .await;

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(get_body))
            .mount(&mock_server)
            .await;

        let (store, _dir) = make_store();
        store
            .push_string("manual_review_list", "other/repo#99".to_string())
            .unwrap();

        let client = GitHubClient::with_base_url("token".to_string(), mock_server.uri());
        let prs = fetch_review_prs(&client, &store, "user").await.unwrap();

        assert_eq!(prs.len(), 2);
        let manual = prs.iter().find(|p| p.id == "other/repo#99").unwrap();
        assert!(manual.is_manual);
        let regular = prs.iter().find(|p| p.id == "org/repo#10").unwrap();
        assert!(!regular.is_manual);
    }

    #[tokio::test]
    async fn test_fetch_review_prs_deduplication() {
        let mock_server = MockServer::start().await;

        // The search PR and the manual PR have the same id
        let search_body = search_response_with_pr(10, "Review PR", "org/repo");
        let get_body = get_pr_response(10, "Review PR", "org/repo");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(search_body))
            .up_to_n_times(1)
            .mount(&mock_server)
            .await;

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(get_body))
            .mount(&mock_server)
            .await;

        let (store, _dir) = make_store();
        store
            .push_string("manual_review_list", "org/repo#10".to_string())
            .unwrap();

        let client = GitHubClient::with_base_url("token".to_string(), mock_server.uri());
        let prs = fetch_review_prs(&client, &store, "user").await.unwrap();

        // Should only have one, not duplicated
        assert_eq!(prs.len(), 1);
    }

    #[tokio::test]
    async fn test_add_pr_by_url_logic() {
        let mock_server = MockServer::start().await;
        let body = get_pr_response(42, "New PR", "org/repo");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let (store, _dir) = make_store();
        let client = GitHubClient::with_base_url("token".to_string(), mock_server.uri());

        let pr = add_pr_by_url_logic(&client, &store, "https://github.com/org/repo/pull/42")
            .await
            .unwrap();

        assert_eq!(pr.id, "org/repo#42");
        assert!(pr.is_manual);

        // Verify it was stored
        let stored = store.get_strings("manual_review_list");
        assert!(stored.contains(&"org/repo#42".to_string()));
    }

    #[tokio::test]
    async fn test_fetch_review_prs_skips_failed_manual() {
        let mock_server = MockServer::start().await;

        // Search returns empty
        let search_body = serde_json::json!({
            "data": { "search": { "nodes": [] } }
        });

        // Manual PR fetch fails
        let error_body = serde_json::json!({
            "data": null,
            "errors": [{ "message": "PR not found" }]
        });

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(search_body))
            .up_to_n_times(1)
            .mount(&mock_server)
            .await;

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(error_body))
            .mount(&mock_server)
            .await;

        let (store, _dir) = make_store();
        store
            .push_string("manual_review_list", "org/repo#999".to_string())
            .unwrap();

        let client = GitHubClient::with_base_url("token".to_string(), mock_server.uri());
        let prs = fetch_review_prs(&client, &store, "user").await.unwrap();

        // Failed manual PR should be skipped gracefully
        assert_eq!(prs.len(), 0);
    }

    // ---- Priority tests ----

    #[test]
    fn test_set_priority_valid_values() {
        let (store, _dir) = make_store();
        for p in 0u8..=3 {
            set_priority_impl(&store, "owner/repo#1", p).unwrap();
        }
    }

    #[test]
    fn test_set_priority_invalid_four() {
        let (store, _dir) = make_store();
        let err = set_priority_impl(&store, "owner/repo#1", 4).unwrap_err();
        assert!(err.to_string().contains("Priority must be 0-3"));
    }

    #[test]
    fn test_set_priority_invalid_five() {
        let (store, _dir) = make_store();
        let err = set_priority_impl(&store, "owner/repo#1", 5).unwrap_err();
        assert!(err.to_string().contains("Priority must be 0-3"));
    }

    #[test]
    fn test_set_priority_invalid_255() {
        let (store, _dir) = make_store();
        let err = set_priority_impl(&store, "owner/repo#1", 255).unwrap_err();
        assert!(err.to_string().contains("Priority must be 0-3"));
    }

    #[test]
    fn test_set_priority_overwrite_existing() {
        let (store, _dir) = make_store();
        set_priority_impl(&store, "owner/repo#1", 2).unwrap();
        set_priority_impl(&store, "owner/repo#1", 3).unwrap();
        let all = get_all_priorities_impl(&store);
        assert_eq!(all.get("owner/repo#1"), Some(&3u8));
    }

    #[test]
    fn test_clear_priority_existing() {
        let (store, _dir) = make_store();
        set_priority_impl(&store, "owner/repo#1", 3).unwrap();
        clear_priority_impl(&store, "owner/repo#1").unwrap();
        let all = get_all_priorities_impl(&store);
        assert!(!all.contains_key("owner/repo#1"));
    }

    #[test]
    fn test_clear_priority_nonexistent() {
        let (store, _dir) = make_store();
        // Should not error when clearing a priority that was never set
        clear_priority_impl(&store, "owner/repo#999").unwrap();
    }

    #[test]
    fn test_get_all_priorities_empty_store() {
        let (store, _dir) = make_store();
        let all = get_all_priorities_impl(&store);
        assert!(all.is_empty());
    }

    #[test]
    fn test_get_all_priorities_multiple_entries() {
        let (store, _dir) = make_store();
        set_priority_impl(&store, "org/a#1", 0).unwrap();
        set_priority_impl(&store, "org/b#2", 1).unwrap();
        set_priority_impl(&store, "org/c#3", 2).unwrap();
        set_priority_impl(&store, "org/d#4", 3).unwrap();

        let all = get_all_priorities_impl(&store);
        assert_eq!(all.len(), 4);
        assert_eq!(all["org/a#1"], 0);
        assert_eq!(all["org/b#2"], 1);
        assert_eq!(all["org/c#3"], 2);
        assert_eq!(all["org/d#4"], 3);
    }

    #[test]
    fn test_get_all_priorities_skips_invalid_entries() {
        let (store, _dir) = make_store();
        // Manually insert invalid values (4, 5, and a string) and one valid value into the object
        store
            .set_object_field(PR_PRIORITIES_KEY, "org/a#1", serde_json::json!(4))
            .unwrap();
        store
            .set_object_field(PR_PRIORITIES_KEY, "org/b#2", serde_json::json!(5))
            .unwrap();
        store
            .set_object_field(PR_PRIORITIES_KEY, "org/c#3", serde_json::json!("bad"))
            .unwrap();
        store
            .set_object_field(PR_PRIORITIES_KEY, "org/d#4", serde_json::json!(2))
            .unwrap();

        let all = get_all_priorities_impl(&store);
        // Only org/d#4 with value 2 should survive
        assert_eq!(all.len(), 1);
        assert_eq!(all["org/d#4"], 2);
    }

    #[test]
    fn test_priority_full_roundtrip() {
        let (store, _dir) = make_store();
        let id = "myorg/myrepo#42";

        // set
        set_priority_impl(&store, id, 3).unwrap();
        let all = get_all_priorities_impl(&store);
        assert_eq!(all.get(id), Some(&3u8));

        // overwrite
        set_priority_impl(&store, id, 1).unwrap();
        let all = get_all_priorities_impl(&store);
        assert_eq!(all.get(id), Some(&1u8));

        // clear
        clear_priority_impl(&store, id).unwrap();
        let all = get_all_priorities_impl(&store);
        assert!(!all.contains_key(id));

        // get after clear returns nothing
        let all = get_all_priorities_impl(&store);
        assert!(all.is_empty());
    }
}
