use crate::commands::prs::AppState;
use crate::store::json_store::JsonStore;

const MANUAL_REVIEW_LIST_KEY: &str = "manual_review_list";

// ---- Pure business logic ----

pub fn remove_from_review_list_logic(store: &JsonStore, id: &str) -> Result<(), String> {
    store
        .remove_string(MANUAL_REVIEW_LIST_KEY, id)
        .map_err(String::from)
}

pub fn get_manual_review_list_logic(store: &JsonStore) -> Vec<String> {
    store.get_strings(MANUAL_REVIEW_LIST_KEY)
}

// ---- Tauri commands ----

#[tauri::command]
pub async fn remove_from_review_list(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    remove_from_review_list_logic(&state.store, &id)
}

#[tauri::command]
pub async fn get_manual_review_list(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, String> {
    Ok(get_manual_review_list_logic(&state.store))
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
    fn test_get_manual_review_list_empty() {
        let (store, _dir) = make_store();
        let list = get_manual_review_list_logic(&store);
        assert!(list.is_empty());
    }

    #[test]
    fn test_get_manual_review_list_with_items() {
        let (store, _dir) = make_store();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "owner/repo#1".to_string())
            .unwrap();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "owner/repo#2".to_string())
            .unwrap();

        let list = get_manual_review_list_logic(&store);
        assert_eq!(list.len(), 2);
        assert!(list.contains(&"owner/repo#1".to_string()));
        assert!(list.contains(&"owner/repo#2".to_string()));
    }

    #[test]
    fn test_remove_from_review_list() {
        let (store, _dir) = make_store();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "owner/repo#1".to_string())
            .unwrap();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "owner/repo#2".to_string())
            .unwrap();

        remove_from_review_list_logic(&store, "owner/repo#1").unwrap();

        let list = get_manual_review_list_logic(&store);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0], "owner/repo#2");
    }

    #[test]
    fn test_remove_nonexistent_item() {
        let (store, _dir) = make_store();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "owner/repo#1".to_string())
            .unwrap();

        // Should not error
        remove_from_review_list_logic(&store, "owner/repo#99").unwrap();

        let list = get_manual_review_list_logic(&store);
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_remove_from_empty_list() {
        let (store, _dir) = make_store();
        // Should not error
        remove_from_review_list_logic(&store, "owner/repo#1").unwrap();
        let list = get_manual_review_list_logic(&store);
        assert!(list.is_empty());
    }

    #[test]
    fn test_remove_all_items() {
        let (store, _dir) = make_store();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "a/b#1".to_string())
            .unwrap();
        store
            .push_string(MANUAL_REVIEW_LIST_KEY, "a/b#2".to_string())
            .unwrap();

        remove_from_review_list_logic(&store, "a/b#1").unwrap();
        remove_from_review_list_logic(&store, "a/b#2").unwrap();

        let list = get_manual_review_list_logic(&store);
        assert!(list.is_empty());
    }
}
