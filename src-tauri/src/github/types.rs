use serde::{Deserialize, Serialize};

/// Public type sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    pub id: String, // "{owner}/{repo}#{number}"
    pub number: i64,
    pub title: String,
    pub url: String,
    pub repo: String,     // "owner/repo"
    pub repo_url: String, // "https://github.com/owner/repo"
    pub author: String,
    pub author_avatar: String,
    pub approvals: i64,
    pub review_decision: Option<String>, // "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED"
    pub mergeable: String,               // "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
    pub is_draft: bool,
    pub created_at: String, // ISO 8601
    pub updated_at: String,
    pub labels: Vec<String>,
    pub checks_status: Option<String>, // "SUCCESS" | "FAILURE" | "PENDING" | "NEUTRAL"
    pub is_manual: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthStatus {
    pub authenticated: bool,
    pub username: Option<String>,
}

// ---- Internal GraphQL response types ----

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GraphQLResponse<T> {
    pub data: Option<T>,
    pub errors: Option<Vec<GraphQLError>>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct GraphQLError {
    pub message: String,
}

// Search response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchData {
    pub search: SearchConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchConnection {
    pub nodes: Vec<GqlPullRequest>,
}

// Single PR response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryData {
    pub repository: GqlRepository,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlRepository {
    pub pull_request: GqlPullRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlPullRequest {
    pub number: i64,
    pub title: String,
    pub url: String,
    pub is_draft: bool,
    pub mergeable: String,
    pub created_at: String,
    pub updated_at: String,
    pub repository: GqlPrRepository,
    pub author: Option<GqlAuthor>,
    pub review_decision: Option<String>,
    pub reviews: GqlReviewConnection,
    pub labels: GqlLabelConnection,
    pub commits: GqlCommitConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlPrRepository {
    pub name_with_owner: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlAuthor {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlReviewConnection {
    pub total_count: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlLabelConnection {
    pub nodes: Vec<GqlLabel>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlLabel {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlCommitConnection {
    pub nodes: Vec<GqlCommitNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlCommitNode {
    pub commit: GqlCommit,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlCommit {
    pub status_check_rollup: Option<GqlStatusCheckRollup>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GqlStatusCheckRollup {
    pub state: String,
}

impl GqlPullRequest {
    pub(crate) fn into_pull_request(self, is_manual: bool) -> PullRequest {
        let repo = self.repository.name_with_owner.clone();
        let repo_url = self.repository.url.clone();
        let id = format!("{}#{}", repo, self.number);

        let author_login = self
            .author
            .as_ref()
            .map(|a| a.login.clone())
            .unwrap_or_default();
        let author_avatar = self
            .author
            .as_ref()
            .map(|a| a.avatar_url.clone())
            .unwrap_or_default();

        let labels = self.labels.nodes.iter().map(|l| l.name.clone()).collect();

        let checks_status = self
            .commits
            .nodes
            .last()
            .and_then(|n| n.commit.status_check_rollup.as_ref())
            .map(|s| s.state.clone());

        PullRequest {
            id,
            number: self.number,
            title: self.title,
            url: self.url,
            repo,
            repo_url,
            author: author_login,
            author_avatar,
            approvals: self.reviews.total_count,
            review_decision: self.review_decision,
            mergeable: self.mergeable,
            is_draft: self.is_draft,
            created_at: self.created_at,
            updated_at: self.updated_at,
            labels,
            checks_status,
            is_manual,
        }
    }
}
