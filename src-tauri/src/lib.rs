mod google;

use anyhow::{Context, Result, anyhow};
use chrono::{Local, Weekday};
use rand::seq::IndexedRandom;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use specta_typescript::Typescript;
use std::fs;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

use dotenvy::dotenv;

use crate::google::{GoogleClient, GoogleColorList, GoogleEvent, GoogleTask, GoogleTasklist};

#[derive(Serialize, specta::Type)]
struct AppError(String);

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError(format!("{:#}", e))
    }
}

type CmdResult<T> = Result<T, AppError>;

#[tauri::command]
#[specta::specta]
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

#[tauri::command]
#[specta::specta]
async fn get_all_events(app: tauri::AppHandle) -> CmdResult<Vec<GoogleEvent>> {
    let client = app.state::<GoogleClient>();

    let calendars = client.get_calendars().await?;

    let mut events: Vec<GoogleEvent> = Vec::new();

    for calendar in &calendars {
        let cevents = client.get_events(urlencoding::encode(&calendar.id).into_owned().as_str()).await?;

        events.extend(cevents);
    }

    Ok(events)
}

#[tauri::command]
#[specta::specta]
async fn get_colors(app: tauri::AppHandle) -> CmdResult<GoogleColorList> {
    let client = app.state::<GoogleClient>();

    Ok(client.get_colors().await?)
}


#[tauri::command]
#[specta::specta]
async fn get_tasklists(app: tauri::AppHandle) -> CmdResult<Vec<GoogleTasklist>> {
    let client = app.state::<GoogleClient>();

    Ok(client.get_tasklists().await?)
}

#[tauri::command]
#[specta::specta]
async fn get_tasks(app: tauri::AppHandle, tasklist: GoogleTasklist) -> CmdResult<Vec<GoogleTask>> {
    let client = app.state::<GoogleClient>();

    Ok(client.get_tasks(tasklist).await?)
}

#[tauri::command]
#[specta::specta]
async fn set_task(app: tauri::AppHandle, task: GoogleTask) -> CmdResult<GoogleTask> {
    let client = app.state::<GoogleClient>();

    Ok(client.set_task(task).await?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();
    let mut builder =
        Builder::<tauri::Wry>::new().commands(collect_commands![get_rand_photo, get_all_events, get_colors, get_tasklists, get_tasks, set_task]);

    builder
        .export(
            Typescript::default(),
            "/home/henryw/projects/dashboard/src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .manage(GoogleClient::new(
            std::env::var("CLIENT_ID").expect("Client ID env var not found"),
            std::env::var("CLIENT_SECRET").expect("Client secret env var not found"),
            std::env::var("REFRESH_TOKEN").expect("Refresh Token env var not found"),
        ))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
