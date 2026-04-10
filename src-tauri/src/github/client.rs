use crate::error::AppError;
use crate::github::queries::{GET_PR_QUERY, SEARCH_PRS_QUERY};
use crate::github::types::{GraphQLResponse, PullRequest, RepositoryData, SearchData};
use serde_json::json;

pub struct GitHubClient {
    http: reqwest::Client,
    base_url: String,
    token: String,
}

impl GitHubClient {
    pub fn new(token: String) -> Self {
        Self::with_base_url(token, "https://api.github.com".to_string())
    }

    pub fn with_base_url(token: String, base_url: String) -> Self {
        let http = reqwest::Client::builder()
            .user_agent("all-p0/0.1.0")
            .build()
            .expect("Failed to build HTTP client");

        Self {
            http,
            base_url,
            token,
        }
    }

    pub async fn get_my_prs(&self, username: &str) -> Result<Vec<PullRequest>, AppError> {
        let query = format!("is:open is:pr author:{username} archived:false");
        self.search_prs(&query).await
    }

    pub async fn get_review_prs(&self, username: &str) -> Result<Vec<PullRequest>, AppError> {
        let query = format!("is:open is:pr review-requested:{username} archived:false");
        self.search_prs(&query).await
    }

    pub async fn get_pr_by_url(&self, url: &str) -> Result<PullRequest, AppError> {
        // Parse URL: https://github.com/{owner}/{repo}/pull/{number}
        let url_str = url.trim_end_matches('/');

        // Validate it's a github.com URL
        if !url_str.contains("github.com") {
            return Err(AppError::InvalidUrl(format!("Not a GitHub URL: {url}")));
        }

        // Strip protocol + domain
        let path = url_str
            .split("github.com/")
            .nth(1)
            .ok_or_else(|| AppError::InvalidUrl(format!("Cannot parse GitHub URL: {url}")))?;

        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() < 4 || parts[2] != "pull" {
            return Err(AppError::InvalidUrl(format!(
                "URL must be in format https://github.com/{{owner}}/{{repo}}/pull/{{number}}: {url}"
            )));
        }

        let owner = parts[0];
        let repo = parts[1];
        let number: i64 = parts[3].parse().map_err(|_| {
            let part = parts[3];
            AppError::InvalidUrl(format!("Invalid PR number: {part}"))
        })?;

        let variables = json!({
            "owner": owner,
            "name": repo,
            "number": number,
        });

        let data: RepositoryData = self.graphql(GET_PR_QUERY, variables).await?;
        Ok(data.repository.pull_request.into_pull_request(false))
    }

    async fn search_prs(&self, search_query: &str) -> Result<Vec<PullRequest>, AppError> {
        let variables = json!({ "query": search_query });
        let data: SearchData = self.graphql(SEARCH_PRS_QUERY, variables).await?;

        let prs = data
            .search
            .nodes
            .into_iter()
            .map(|n| n.into_pull_request(false))
            .collect();

        Ok(prs)
    }

    async fn graphql<T: serde::de::DeserializeOwned>(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> Result<T, AppError> {
        let body = json!({
            "query": query,
            "variables": variables,
        });

        let response = self
            .http
            .post(format!("{}/graphql", self.base_url))
            .bearer_auth(&self.token)
            .json(&body)
            .send()
            .await?;

        let gql_response: GraphQLResponse<T> = response.json().await?;

        if let Some(errors) = gql_response.errors {
            if !errors.is_empty() {
                let messages: Vec<String> = errors.iter().map(|e| e.message.clone()).collect();
                return Err(AppError::GitHub(messages.join("; ")));
            }
        }

        gql_response
            .data
            .ok_or_else(|| AppError::GitHub("No data in GraphQL response".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_pr_node(number: i64, title: &str, owner_repo: &str) -> serde_json::Value {
        let (owner, repo) = owner_repo.split_once('/').unwrap_or(("owner", "repo"));
        json!({
            "number": number,
            "title": title,
            "url": format!("https://github.com/{owner}/{repo}/pull/{number}"),
            "isDraft": false,
            "mergeable": "MERGEABLE",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-02T00:00:00Z",
            "repository": {
                "nameWithOwner": owner_repo,
                "url": format!("https://github.com/{owner_repo}")
            },
            "author": {
                "login": "octocat",
                "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4"
            },
            "reviewDecision": "APPROVED",
            "reviews": { "totalCount": 2 },
            "labels": { "nodes": [{ "name": "bug" }, { "name": "p0" }] },
            "commits": {
                "nodes": [{
                    "commit": {
                        "statusCheckRollup": { "state": "SUCCESS" }
                    }
                }]
            }
        })
    }

    fn search_response(nodes: Vec<serde_json::Value>) -> serde_json::Value {
        json!({
            "data": {
                "search": {
                    "nodes": nodes
                }
            }
        })
    }

    fn get_pr_response(node: serde_json::Value, _owner: &str, _repo: &str) -> serde_json::Value {
        json!({
            "data": {
                "repository": {
                    "pullRequest": node
                }
            }
        })
    }

    #[tokio::test]
    async fn test_get_my_prs_happy_path() {
        let mock_server = MockServer::start().await;

        let pr1 = make_pr_node(1, "Fix bug", "owner/repo");
        let pr2 = make_pr_node(2, "Add feature", "owner/repo");
        let body = search_response(vec![pr1, pr2]);

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let prs = client.get_my_prs("octocat").await.unwrap();

        assert_eq!(prs.len(), 2);
        assert_eq!(prs[0].number, 1);
        assert_eq!(prs[0].title, "Fix bug");
        assert_eq!(prs[0].id, "owner/repo#1");
        assert_eq!(prs[0].repo, "owner/repo");
        assert_eq!(prs[0].author, "octocat");
        assert_eq!(prs[0].approvals, 2);
        assert_eq!(prs[0].checks_status, Some("SUCCESS".to_string()));
        assert_eq!(prs[0].labels, vec!["bug", "p0"]);
        assert_eq!(prs[0].review_decision, Some("APPROVED".to_string()));
        assert!(!prs[0].is_manual);
    }

    #[tokio::test]
    async fn test_get_review_prs_happy_path() {
        let mock_server = MockServer::start().await;

        let pr1 = make_pr_node(5, "Review this", "acme/project");
        let body = search_response(vec![pr1]);

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let prs = client.get_review_prs("octocat").await.unwrap();

        assert_eq!(prs.len(), 1);
        assert_eq!(prs[0].number, 5);
        assert_eq!(prs[0].title, "Review this");
        assert_eq!(prs[0].id, "acme/project#5");
    }

    #[tokio::test]
    async fn test_empty_search_results() {
        let mock_server = MockServer::start().await;

        let body = search_response(vec![]);

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let prs = client.get_my_prs("octocat").await.unwrap();

        assert!(prs.is_empty());
    }

    #[tokio::test]
    async fn test_graphql_error_in_response() {
        let mock_server = MockServer::start().await;

        let body = json!({
            "data": null,
            "errors": [
                { "message": "Could not resolve to a Repository with the name 'bad/repo'." }
            ]
        });

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let result = client.get_my_prs("octocat").await;

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("GitHub API error"));
        assert!(err.contains("Could not resolve"));
    }

    #[tokio::test]
    async fn test_network_error() {
        // Use a port that's definitely not listening
        let client = GitHubClient::with_base_url(
            "test-token".to_string(),
            "http://127.0.0.1:19999".to_string(),
        );
        let result = client.get_my_prs("octocat").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_get_pr_by_url_valid() {
        let mock_server = MockServer::start().await;

        let pr_node = make_pr_node(42, "My PR", "owner/repo");
        let body = get_pr_response(pr_node, "owner", "repo");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let pr = client
            .get_pr_by_url("https://github.com/owner/repo/pull/42")
            .await
            .unwrap();

        assert_eq!(pr.number, 42);
        assert_eq!(pr.title, "My PR");
        assert_eq!(pr.id, "owner/repo#42");
    }

    #[tokio::test]
    async fn test_get_pr_by_url_with_trailing_slash() {
        let mock_server = MockServer::start().await;

        let pr_node = make_pr_node(10, "Trailing slash PR", "org/proj");
        let body = get_pr_response(pr_node, "org", "proj");

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let pr = client
            .get_pr_by_url("https://github.com/org/proj/pull/10/")
            .await
            .unwrap();

        assert_eq!(pr.number, 10);
    }

    #[test]
    fn test_get_pr_by_url_wrong_domain() {
        let client =
            GitHubClient::with_base_url("token".to_string(), "http://example.com".to_string());
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(client.get_pr_by_url("https://gitlab.com/owner/repo/merge_requests/1"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Not a GitHub URL"));
    }

    #[test]
    fn test_get_pr_by_url_missing_pull_segment() {
        let client =
            GitHubClient::with_base_url("token".to_string(), "http://example.com".to_string());
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(client.get_pr_by_url("https://github.com/owner/repo/issues/1"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("URL must be in format"));
    }

    #[test]
    fn test_get_pr_by_url_non_numeric_number() {
        let client =
            GitHubClient::with_base_url("token".to_string(), "http://example.com".to_string());
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(client.get_pr_by_url("https://github.com/owner/repo/pull/abc"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Invalid PR number"));
    }

    #[test]
    fn test_get_pr_by_url_too_short() {
        let client =
            GitHubClient::with_base_url("token".to_string(), "http://example.com".to_string());
        let result = tokio::runtime::Runtime::new()
            .unwrap()
            .block_on(client.get_pr_by_url("https://github.com/owner/repo"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("URL must be in format"));
    }

    #[tokio::test]
    async fn test_all_fields_mapped_correctly() {
        let mock_server = MockServer::start().await;

        let pr_node = json!({
            "number": 99,
            "title": "Full field test",
            "url": "https://github.com/myorg/myrepo/pull/99",
            "isDraft": true,
            "mergeable": "CONFLICTING",
            "createdAt": "2024-03-15T10:00:00Z",
            "updatedAt": "2024-03-16T12:00:00Z",
            "repository": {
                "nameWithOwner": "myorg/myrepo",
                "url": "https://github.com/myorg/myrepo"
            },
            "author": {
                "login": "testuser",
                "avatarUrl": "https://avatars.githubusercontent.com/u/99?v=4"
            },
            "reviewDecision": "CHANGES_REQUESTED",
            "reviews": { "totalCount": 0 },
            "labels": { "nodes": [{ "name": "wip" }] },
            "commits": {
                "nodes": [{
                    "commit": {
                        "statusCheckRollup": { "state": "FAILURE" }
                    }
                }]
            }
        });

        let body = search_response(vec![pr_node]);

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let prs = client.get_my_prs("testuser").await.unwrap();

        assert_eq!(prs.len(), 1);
        let pr = &prs[0];
        assert_eq!(pr.id, "myorg/myrepo#99");
        assert_eq!(pr.number, 99);
        assert_eq!(pr.title, "Full field test");
        assert_eq!(pr.url, "https://github.com/myorg/myrepo/pull/99");
        assert_eq!(pr.repo, "myorg/myrepo");
        assert_eq!(pr.repo_url, "https://github.com/myorg/myrepo");
        assert_eq!(pr.author, "testuser");
        assert_eq!(
            pr.author_avatar,
            "https://avatars.githubusercontent.com/u/99?v=4"
        );
        assert_eq!(pr.approvals, 0);
        assert_eq!(pr.review_decision, Some("CHANGES_REQUESTED".to_string()));
        assert_eq!(pr.mergeable, "CONFLICTING");
        assert!(pr.is_draft);
        assert_eq!(pr.created_at, "2024-03-15T10:00:00Z");
        assert_eq!(pr.updated_at, "2024-03-16T12:00:00Z");
        assert_eq!(pr.labels, vec!["wip"]);
        assert_eq!(pr.checks_status, Some("FAILURE".to_string()));
        assert!(!pr.is_manual);
    }

    #[tokio::test]
    async fn test_pr_with_no_status_check_rollup() {
        let mock_server = MockServer::start().await;

        let pr_node = json!({
            "number": 1,
            "title": "No checks",
            "url": "https://github.com/owner/repo/pull/1",
            "isDraft": false,
            "mergeable": "UNKNOWN",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
            "repository": {
                "nameWithOwner": "owner/repo",
                "url": "https://github.com/owner/repo"
            },
            "author": null,
            "reviewDecision": null,
            "reviews": { "totalCount": 0 },
            "labels": { "nodes": [] },
            "commits": {
                "nodes": [{
                    "commit": {
                        "statusCheckRollup": null
                    }
                }]
            }
        });

        let body = search_response(vec![pr_node]);

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let prs = client.get_my_prs("octocat").await.unwrap();

        assert_eq!(prs.len(), 1);
        assert!(prs[0].checks_status.is_none());
        assert!(prs[0].review_decision.is_none());
        assert_eq!(prs[0].author, "");
        assert_eq!(prs[0].labels, Vec::<String>::new());
    }

    #[tokio::test]
    async fn test_no_data_in_response() {
        let mock_server = MockServer::start().await;

        let body = json!({
            "data": null,
            "errors": null
        });

        Mock::given(method("POST"))
            .and(path("/graphql"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&mock_server)
            .await;

        let client = GitHubClient::with_base_url("test-token".to_string(), mock_server.uri());
        let result = client.get_my_prs("octocat").await;

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No data in GraphQL response"));
    }
}
