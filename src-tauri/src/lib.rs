mod secure;
mod smtp;
mod ai_http;

/// Entry point shared by the desktop binary and (potentially) mobile targets.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            secure::secure_set,
            secure::secure_get,
            secure::secure_delete,
            smtp::smtp_test,
            smtp::smtp_send,
            ai_http::ai_http_post,
        ])
        .run(tauri::generate_context!())
        .expect("error while running letterflow");
}
