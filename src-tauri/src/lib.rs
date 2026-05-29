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

use crate::google::GoogleClient;

#[derive(Serialize, specta::Type)]
struct AppError(String);

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError(e.to_string())
    }
}

type CmdResult<T> = Result<T, AppError>;

#[derive(Serialize, Deserialize, specta::Type)]
struct GoogleDate {
    date: Option<String>,
    dateTime: Option<String>,
}

#[derive(Serialize, Deserialize, specta::Type)]
struct GoogleEvent {
    summary: String,
    description: Option<String>,
    id: String,
    start: GoogleDate,
    end: GoogleDate,
    htmlLink: String,
}

#[derive(Serialize, Deserialize, specta::Type)]
struct GoogleEventList {
    items: Vec<GoogleEvent>,
}

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
async fn get_events(calendar: &str, app: tauri::AppHandle) -> CmdResult<GoogleEventList> {
    let client = app.state::<GoogleClient>();

    let week = Local::now().date_naive().week(Weekday::Sun);

    let sunday: String = week
        .first_day()
        .and_hms_opt(0, 0, 0)
        .context("Failed to calculate start")?
        .and_local_timezone(Local)
        .single()
        .context("Failed to get timezone")?
        .to_rfc3339();

    let saturday: String = week
        .last_day()
        .and_hms_opt(23, 59, 59)
        .context("Failed to calculate end")?
        .and_local_timezone(Local)
        .single()
        .context("Failed to get timezone")?
        .to_rfc3339();

    let response = client
        .request(
            Method::GET,
            format!(
                "https://www.googleapis.com/calendar/v3/calendars/{}/events",
                calendar
            )
            .as_str(),
        )
        .await?
        .query(&[("timeMin", sunday), ("timeMax", saturday)])
        .send()
        .await
        .context("Failed to send request")?;

    println!("{}", response.url());
    
    let text = response.text().await.context("Failed to get response text")?;

    println!("{}", text);

    let events: GoogleEventList = serde_json::from_str(&text).map_err(|e| anyhow!(e))?;

    //let events: GoogleEventList = response.json().await.context("Failed to parse response")?;
    
    Ok(events)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();
    let mut builder =
        Builder::<tauri::Wry>::new().commands(collect_commands![get_rand_photo, get_events]);

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
