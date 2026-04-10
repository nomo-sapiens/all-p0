use crate::error::AppError;
use std::collections::HashMap;
use std::path::PathBuf;

pub struct JsonStore {
    path: PathBuf,
}

impl JsonStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    /// Read all data from the JSON file (returns empty map if file doesn't exist)
    fn read(&self) -> Result<HashMap<String, Vec<String>>, AppError> {
        if !self.path.exists() {
            return Ok(HashMap::new());
        }
        let content = std::fs::read_to_string(&self.path)?;
        let map: HashMap<String, Vec<String>> = serde_json::from_str(&content)?;
        Ok(map)
    }

    /// Write all data to the JSON file (creates parent dirs if needed)
    fn write(&self, data: &HashMap<String, Vec<String>>) -> Result<(), AppError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(data)?;
        std::fs::write(&self.path, content)?;
        Ok(())
    }

    pub fn get_strings(&self, key: &str) -> Vec<String> {
        self.read()
            .ok()
            .and_then(|mut map| map.remove(key))
            .unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn set_strings(&self, key: &str, values: &[String]) -> Result<(), AppError> {
        let mut data = self.read()?;
        data.insert(key.to_string(), values.to_vec());
        self.write(&data)
    }

    pub fn push_string(&self, key: &str, value: String) -> Result<(), AppError> {
        let mut data = self.read()?;
        let list = data.entry(key.to_string()).or_default();
        if !list.contains(&value) {
            list.push(value);
        }
        self.write(&data)
    }

    pub fn remove_string(&self, key: &str, value: &str) -> Result<(), AppError> {
        let mut data = self.read()?;
        if let Some(list) = data.get_mut(key) {
            list.retain(|v| v != value);
        }
        self.write(&data)
    }

    #[allow(dead_code)]
    pub fn contains(&self, key: &str, value: &str) -> bool {
        self.read()
            .ok()
            .and_then(|map| map.get(key).map(|list| list.iter().any(|v| v == value)))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn make_store() -> (JsonStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test-store.json");
        let store = JsonStore::new(path);
        (store, dir)
    }

    #[test]
    fn test_get_strings_missing_file() {
        let (store, _dir) = make_store();
        let result = store.get_strings("some-key");
        assert!(result.is_empty());
    }

    #[test]
    fn test_set_and_get_strings() {
        let (store, _dir) = make_store();
        let values = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        store.set_strings("my-key", &values).unwrap();
        let got = store.get_strings("my-key");
        assert_eq!(got, values);
    }

    #[test]
    fn test_push_string() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        store.push_string("list", "item2".to_string()).unwrap();
        let got = store.get_strings("list");
        assert_eq!(got, vec!["item1", "item2"]);
    }

    #[test]
    fn test_push_string_no_duplicates() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        store.push_string("list", "item1".to_string()).unwrap();
        let got = store.get_strings("list");
        assert_eq!(got.len(), 1);
        assert_eq!(got[0], "item1");
    }

    #[test]
    fn test_remove_string() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        store.push_string("list", "item2".to_string()).unwrap();
        store.push_string("list", "item3".to_string()).unwrap();

        store.remove_string("list", "item2").unwrap();
        let got = store.get_strings("list");
        assert_eq!(got, vec!["item1", "item3"]);
    }

    #[test]
    fn test_remove_nonexistent_string() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        // Should not error when removing something that doesn't exist
        store.remove_string("list", "nonexistent").unwrap();
        let got = store.get_strings("list");
        assert_eq!(got, vec!["item1"]);
    }

    #[test]
    fn test_remove_from_nonexistent_key() {
        let (store, _dir) = make_store();
        // Should not error when removing from a key that doesn't exist
        store.remove_string("no-such-key", "value").unwrap();
    }

    #[test]
    fn test_contains_true() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        assert!(store.contains("list", "item1"));
    }

    #[test]
    fn test_contains_false() {
        let (store, _dir) = make_store();
        store.push_string("list", "item1".to_string()).unwrap();
        assert!(!store.contains("list", "item2"));
    }

    #[test]
    fn test_contains_missing_key() {
        let (store, _dir) = make_store();
        assert!(!store.contains("no-such-key", "value"));
    }

    #[test]
    fn test_contains_missing_file() {
        let (store, _dir) = make_store();
        assert!(!store.contains("key", "value"));
    }

    #[test]
    fn test_roundtrip_multiple_keys() {
        let (store, _dir) = make_store();
        store
            .set_strings("key1", &["a".to_string(), "b".to_string()])
            .unwrap();
        store.set_strings("key2", &["x".to_string()]).unwrap();

        assert_eq!(store.get_strings("key1"), vec!["a", "b"]);
        assert_eq!(store.get_strings("key2"), vec!["x"]);
    }

    #[test]
    fn test_set_empty_list() {
        let (store, _dir) = make_store();
        store
            .set_strings("key", &["a".to_string(), "b".to_string()])
            .unwrap();
        store.set_strings("key", &[]).unwrap();
        let got = store.get_strings("key");
        assert!(got.is_empty());
    }

    #[test]
    fn test_creates_parent_dirs() {
        let dir = tempdir().unwrap();
        let deep_path = dir.path().join("nested").join("deep").join("store.json");
        let store = JsonStore::new(deep_path);
        store.set_strings("key", &["val".to_string()]).unwrap();
        assert_eq!(store.get_strings("key"), vec!["val"]);
    }

    #[test]
    fn test_get_missing_key_returns_empty() {
        let (store, _dir) = make_store();
        store
            .set_strings("other-key", &["val".to_string()])
            .unwrap();
        let result = store.get_strings("missing-key");
        assert!(result.is_empty());
    }
}
