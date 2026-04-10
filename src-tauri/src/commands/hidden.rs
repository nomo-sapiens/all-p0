use crate::commands::prs::AppState;
use crate::store::json_store::JsonStore;

fn pane_key(pane: &str) -> String {
    match pane {
        "mine" => "hidden_mine".to_string(),
        "review" => "hidden_review".to_string(),
        other => format!("hidden_{other}"),
    }
}

// ---- Pure business logic ----

pub fn hide_pr_logic(store: &JsonStore, id: &str, pane: &str) -> Result<(), String> {
    let key = pane_key(pane);
    store
        .push_string(&key, id.to_string())
        .map_err(String::from)
}

pub fn unhide_pr_logic(store: &JsonStore, id: &str, pane: &str) -> Result<(), String> {
    let key = pane_key(pane);
    store.remove_string(&key, id).map_err(String::from)
}

pub fn get_hidden_prs_logic(store: &JsonStore, pane: &str) -> Vec<String> {
    let key = pane_key(pane);
    store.get_strings(&key)
}

// ---- Tauri commands ----

#[tauri::command]
pub async fn hide_pr(
    state: tauri::State<'_, AppState>,
    id: String,
    pane: String,
) -> Result<(), String> {
    hide_pr_logic(&state.store, &id, &pane)
}

#[tauri::command]
pub async fn unhide_pr(
    state: tauri::State<'_, AppState>,
    id: String,
    pane: String,
) -> Result<(), String> {
    unhide_pr_logic(&state.store, &id, &pane)
}

#[tauri::command]
pub async fn get_hidden_prs(
    state: tauri::State<'_, AppState>,
    pane: String,
) -> Result<Vec<String>, String> {
    Ok(get_hidden_prs_logic(&state.store, &pane))
}

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::json_store::JsonStore;
    use tempfile::tempdir;

    fn make_store() -> (JsonStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("store.json");
        (JsonStore::new(path), dir)
    }

    #[test]
    fn test_pane_key_mine() {
        assert_eq!(pane_key("mine"), "hidden_mine");
    }

    #[test]
    fn test_pane_key_review() {
        assert_eq!(pane_key("review"), "hidden_review");
    }

    #[test]
    fn test_pane_key_custom() {
        assert_eq!(pane_key("other"), "hidden_other");
    }

    #[test]
    fn test_hide_pr_mine() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#1", "mine").unwrap();
        let hidden = get_hidden_prs_logic(&store, "mine");
        assert_eq!(hidden, vec!["owner/repo#1"]);
    }

    #[test]
    fn test_hide_pr_review() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#2", "review").unwrap();
        let hidden = get_hidden_prs_logic(&store, "review");
        assert_eq!(hidden, vec!["owner/repo#2"]);
    }

    #[test]
    fn test_hide_prs_different_panes_isolated() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#1", "mine").unwrap();
        hide_pr_logic(&store, "owner/repo#2", "review").unwrap();

        let mine = get_hidden_prs_logic(&store, "mine");
        let review = get_hidden_prs_logic(&store, "review");

        assert_eq!(mine, vec!["owner/repo#1"]);
        assert_eq!(review, vec!["owner/repo#2"]);
    }

    #[test]
    fn test_unhide_pr() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#1", "mine").unwrap();
        hide_pr_logic(&store, "owner/repo#2", "mine").unwrap();

        unhide_pr_logic(&store, "owner/repo#1", "mine").unwrap();

        let hidden = get_hidden_prs_logic(&store, "mine");
        assert_eq!(hidden, vec!["owner/repo#2"]);
    }

    #[test]
    fn test_unhide_pr_not_in_list() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#1", "mine").unwrap();

        // Should not error
        unhide_pr_logic(&store, "owner/repo#99", "mine").unwrap();

        let hidden = get_hidden_prs_logic(&store, "mine");
        assert_eq!(hidden, vec!["owner/repo#1"]);
    }

    #[test]
    fn test_get_hidden_prs_empty() {
        let (store, _dir) = make_store();
        let hidden = get_hidden_prs_logic(&store, "mine");
        assert!(hidden.is_empty());
    }

    #[test]
    fn test_hide_no_duplicates() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "owner/repo#1", "review").unwrap();
        hide_pr_logic(&store, "owner/repo#1", "review").unwrap();

        let hidden = get_hidden_prs_logic(&store, "review");
        assert_eq!(hidden.len(), 1);
    }

    #[test]
    fn test_multiple_hides_and_unhides() {
        let (store, _dir) = make_store();
        hide_pr_logic(&store, "a/b#1", "mine").unwrap();
        hide_pr_logic(&store, "a/b#2", "mine").unwrap();
        hide_pr_logic(&store, "a/b#3", "mine").unwrap();

        unhide_pr_logic(&store, "a/b#2", "mine").unwrap();

        let hidden = get_hidden_prs_logic(&store, "mine");
        assert_eq!(hidden.len(), 2);
        assert!(hidden.contains(&"a/b#1".to_string()));
        assert!(hidden.contains(&"a/b#3".to_string()));
        assert!(!hidden.contains(&"a/b#2".to_string()));
    }
}
