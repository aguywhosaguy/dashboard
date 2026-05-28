mod google;

use anyhow::{Context, Result};
use std::fs;

use dotenvy::dotenv;
use rand::seq::IndexedRandom;

use crate::google::GoogleClient;

struct AppError(anyhow::Error);

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError(e)
    }
}

type CmdResult<T> = Result<T, AppError>;

#[tauri::command]
fn get_rand_photo(folder: &str) -> CmdResult<String> {
    let entries: Vec<_> = fs::read_dir(folder)
        .context("Failed to read dir")?
        .filter_map(|e| {
            let path = e.ok()?.path();
            let ext = path.extension()?.to_str()?.to_lowercase();
            if ["jpg", "jpeg", "png", "webp"].contains(&ext.as_str()) {
                Some(path.to_str()?.to_string())
            } else {
                None
            }
        })
        .collect();

    entries
        .choose(&mut rand::rng())
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("no images found"))
        .map_err(AppError::from)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();

    tauri::Builder::default()
        .manage(GoogleClient::new(
            std::env::var("CLIENT_ID").expect("Client ID env var not found"),
            std::env::var("CLIENT_SECRET").expect("Client secret env var not found"),
            std::env::var("REFRESH_TOKEN").expect("Refresh Token env var not found"),
        ))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_rand_photo])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
