pub const SEARCH_PRS_QUERY: &str = r#"
query SearchPRs($query: String!) {
  search(query: $query, type: ISSUE, first: 100) {
    nodes {
      ... on PullRequest {
        number
        title
        url
        isDraft
        mergeable
        createdAt
        updatedAt
        repository {
          nameWithOwner
          url
        }
        author {
          login
          avatarUrl
        }
        reviewDecision
        reviews(states: [APPROVED], first: 0) {
          totalCount
        }
        labels(first: 10) {
          nodes {
            name
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
}
"#;

pub const GET_PR_QUERY: &str = r#"
query GetPR($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number
      title
      url
      isDraft
      mergeable
      createdAt
      updatedAt
      repository {
        nameWithOwner
        url
      }
      author {
        login
        avatarUrl
      }
      reviewDecision
      reviews(states: [APPROVED], first: 0) {
        totalCount
      }
      labels(first: 10) {
        nodes {
          name
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              state
            }
          }
        }
      }
    }
  }
}
"#;
