mod auth;
mod commands;
mod error;
mod github;
mod store;

use auth::gh_token::TokenProvider;
use commands::prs::AppState;
use github::client::GitHubClient;
use store::json_store::JsonStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let token_provider = auth::gh_token::GhCliTokenProvider;
            let token = token_provider.get_token().unwrap_or_default();
            let username = token_provider.get_username(&token).unwrap_or_default();
            let client = GitHubClient::new(token);

            let store_path = app.path().app_data_dir()?.join("allp0-store.json");
            let store = JsonStore::new(store_path);

            app.manage(AppState {
                github_client: client,
                store,
                username,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::prs::get_my_prs,
            commands::prs::get_review_prs,
            commands::prs::add_pr_by_url,
            commands::prs::get_auth_status,
            commands::prs::set_pr_priority,
            commands::prs::clear_pr_priority,
            commands::prs::get_all_priorities,
            commands::review_list::remove_from_review_list,
            commands::review_list::get_manual_review_list,
            commands::hidden::hide_pr,
            commands::hidden::unhide_pr,
            commands::hidden::get_hidden_prs,
            commands::hidden::open_in_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
