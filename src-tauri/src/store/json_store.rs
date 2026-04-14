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
    fn read(&self) -> Result<HashMap<String, serde_json::Value>, AppError> {
        if !self.path.exists() {
            return Ok(HashMap::new());
        }
        let content = std::fs::read_to_string(&self.path)?;
        let map: HashMap<String, serde_json::Value> = serde_json::from_str(&content)?;
        Ok(map)
    }

    /// Write all data to the JSON file (creates parent dirs if needed)
    fn write(&self, data: &HashMap<String, serde_json::Value>) -> Result<(), AppError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(data)?;
        std::fs::write(&self.path, content)?;
        Ok(())
    }

    // ---- Array (Vec<String>) methods ----

    pub fn get_strings(&self, key: &str) -> Vec<String> {
        self.read()
            .ok()
            .and_then(|map| {
                map.get(key).and_then(|v| match v {
                    serde_json::Value::Array(arr) => Some(
                        arr.iter()
                            .filter_map(|item| item.as_str().map(str::to_string))
                            .collect(),
                    ),
                    _ => None,
                })
            })
            .unwrap_or_default()
    }

    #[allow(dead_code)]
    pub fn set_strings(&self, key: &str, values: &[String]) -> Result<(), AppError> {
        let mut data = self.read()?;
        let arr: Vec<serde_json::Value> = values
            .iter()
            .map(|s| serde_json::Value::String(s.clone()))
            .collect();
        data.insert(key.to_string(), serde_json::Value::Array(arr));
        self.write(&data)
    }

    pub fn push_string(&self, key: &str, value: String) -> Result<(), AppError> {
        let mut data = self.read()?;
        let entry = data
            .entry(key.to_string())
            .or_insert_with(|| serde_json::Value::Array(vec![]));
        if let serde_json::Value::Array(arr) = entry {
            let json_val = serde_json::Value::String(value.clone());
            if !arr.contains(&json_val) {
                arr.push(json_val);
            }
        }
        self.write(&data)
    }

    pub fn remove_string(&self, key: &str, value: &str) -> Result<(), AppError> {
        let mut data = self.read()?;
        if let Some(serde_json::Value::Array(arr)) = data.get_mut(key) {
            arr.retain(|v| v.as_str() != Some(value));
        }
        self.write(&data)
    }

    #[allow(dead_code)]
    pub fn contains(&self, key: &str, value: &str) -> bool {
        self.read()
            .ok()
            .and_then(|map| {
                map.get(key).and_then(|v| match v {
                    serde_json::Value::Array(arr) => {
                        Some(arr.iter().any(|item| item.as_str() == Some(value)))
                    }
                    _ => None,
                })
            })
            .unwrap_or(false)
    }

    // ---- Object (Map<String, Value>) methods ----

    /// Get a stored JSON object as a String→Value map (returns empty map if key absent or wrong type)
    pub fn get_object(&self, key: &str) -> serde_json::Map<String, serde_json::Value> {
        self.read()
            .ok()
            .and_then(|map| {
                map.get(key).and_then(|v| match v {
                    serde_json::Value::Object(obj) => Some(obj.clone()),
                    _ => None,
                })
            })
            .unwrap_or_default()
    }

    /// Set a single field inside a stored JSON object
    pub fn set_object_field(
        &self,
        key: &str,
        field: &str,
        value: serde_json::Value,
    ) -> Result<(), AppError> {
        let mut data = self.read()?;
        let entry = data
            .entry(key.to_string())
            .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
        if let serde_json::Value::Object(obj) = entry {
            obj.insert(field.to_string(), value);
        } else {
            // Key exists but holds a non-object; replace with a fresh object
            let mut obj = serde_json::Map::new();
            obj.insert(field.to_string(), value);
            data.insert(key.to_string(), serde_json::Value::Object(obj));
        }
        self.write(&data)
    }

    /// Remove a single field from a stored JSON object
    pub fn remove_object_field(&self, key: &str, field: &str) -> Result<(), AppError> {
        let mut data = self.read()?;
        if let Some(serde_json::Value::Object(obj)) = data.get_mut(key) {
            obj.remove(field);
        }
        self.write(&data)
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

    // ---- Existing array tests (unchanged behaviour) ----

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

    // ---- New object method tests ----

    #[test]
    fn test_get_object_missing_file() {
        let (store, _dir) = make_store();
        let obj = store.get_object("no-key");
        assert!(obj.is_empty());
    }

    #[test]
    fn test_get_object_missing_key() {
        let (store, _dir) = make_store();
        store
            .set_strings("other-key", &["val".to_string()])
            .unwrap();
        let obj = store.get_object("no-such-key");
        assert!(obj.is_empty());
    }

    #[test]
    fn test_get_object_wrong_type_returns_empty() {
        let (store, _dir) = make_store();
        // Store an array under a key, then call get_object on it
        store.set_strings("arr-key", &["a".to_string()]).unwrap();
        let obj = store.get_object("arr-key");
        assert!(obj.is_empty());
    }

    #[test]
    fn test_set_object_field_and_get_object() {
        let (store, _dir) = make_store();
        store
            .set_object_field("my-obj", "field1", serde_json::json!(42))
            .unwrap();
        let obj = store.get_object("my-obj");
        assert_eq!(obj.get("field1"), Some(&serde_json::json!(42)));
    }

    #[test]
    fn test_set_object_field_roundtrip() {
        let (store, _dir) = make_store();
        store
            .set_object_field("prefs", "theme", serde_json::json!("dark"))
            .unwrap();
        store
            .set_object_field("prefs", "count", serde_json::json!(3))
            .unwrap();

        let obj = store.get_object("prefs");
        assert_eq!(obj.get("theme"), Some(&serde_json::json!("dark")));
        assert_eq!(obj.get("count"), Some(&serde_json::json!(3)));
    }

    #[test]
    fn test_set_object_field_overwrites_existing_field() {
        let (store, _dir) = make_store();
        store
            .set_object_field("obj", "x", serde_json::json!(1))
            .unwrap();
        store
            .set_object_field("obj", "x", serde_json::json!(99))
            .unwrap();
        let obj = store.get_object("obj");
        assert_eq!(obj.get("x"), Some(&serde_json::json!(99)));
    }

    #[test]
    fn test_remove_object_field_existing() {
        let (store, _dir) = make_store();
        store
            .set_object_field("obj", "a", serde_json::json!(1))
            .unwrap();
        store
            .set_object_field("obj", "b", serde_json::json!(2))
            .unwrap();
        store.remove_object_field("obj", "a").unwrap();

        let obj = store.get_object("obj");
        assert!(!obj.contains_key("a"));
        assert_eq!(obj.get("b"), Some(&serde_json::json!(2)));
    }

    #[test]
    fn test_remove_object_field_nonexistent_field() {
        let (store, _dir) = make_store();
        store
            .set_object_field("obj", "a", serde_json::json!(1))
            .unwrap();
        // Should not error when removing a field that doesn't exist
        store.remove_object_field("obj", "nope").unwrap();
        let obj = store.get_object("obj");
        assert_eq!(obj.get("a"), Some(&serde_json::json!(1)));
    }

    #[test]
    fn test_remove_object_field_nonexistent_key() {
        let (store, _dir) = make_store();
        // Should not error when the top-level key doesn't exist
        store.remove_object_field("no-such-key", "field").unwrap();
    }

    #[test]
    fn test_object_and_array_coexist() {
        let (store, _dir) = make_store();
        store.set_strings("arr", &["x".to_string()]).unwrap();
        store
            .set_object_field("map", "k", serde_json::json!("v"))
            .unwrap();

        assert_eq!(store.get_strings("arr"), vec!["x"]);
        let obj = store.get_object("map");
        assert_eq!(obj.get("k"), Some(&serde_json::json!("v")));
    }
}
