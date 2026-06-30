mod config;
mod google;
mod habits;
mod weather;

use anyhow::Result;
use serde::Serialize;
use specta_typescript::Typescript;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Emitter, Manager};
use tauri_specta::{collect_commands, Builder};

use dotenvy::dotenv;

use crate::habits::{Habit, HabitList, HabitLogs};
use crate::weather::LocationWeather;
use crate::{
    config::PublicConfig,
    google::{GoogleClient, GoogleColorList, GoogleEvent, GoogleTask, GoogleTasklist},
};

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
fn quit() {
    std::process::exit(0);
}

#[tauri::command]
#[specta::specta]
async fn get_all_events(app: tauri::AppHandle) -> CmdResult<HashMap<String, Vec<GoogleEvent>>> {
    let client = app.state::<GoogleClient>();

    let calendars = client.get_calendars().await?;

    let mut events: HashMap<String, Vec<GoogleEvent>> = HashMap::new();

    for calendar in &calendars {
        let cevents = client
            .get_events(urlencoding::encode(&calendar.id).into_owned().as_str())
            .await?;

        events.insert(calendar.summary.clone(), cevents);
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

#[tauri::command]
#[specta::specta]
fn get_habits(app: tauri::AppHandle) -> CmdResult<HashMap<String, Habit>> {
    let hlist = app.state::<Arc<Mutex<HabitList>>>();

    let mut hlist = hlist.lock().unwrap();

    *hlist = HabitList::get_from_file()?;

    Ok(hlist.clone().habits)
}

#[tauri::command]
#[specta::specta]
fn complete_habit(app: tauri::AppHandle, habit: &str) -> CmdResult<()> {
    let hlist = app.state::<Arc<Mutex<HabitList>>>();

    let mut hlist = hlist.lock().unwrap();

    let _ = hlist.complete(habit)?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn get_weather(location: String) -> CmdResult<LocationWeather> {
    Ok(LocationWeather::from_location(location).await?)
}

#[tauri::command]
#[specta::specta]
async fn get_habit_history() -> CmdResult<HabitLogs> {
    Ok(HabitLogs::get_from_file()?)
}

#[tauri::command]
#[specta::specta]
fn get_config() -> CmdResult<PublicConfig> {
    Ok(config::get_config()?.public)
}

#[tauri::command]
#[specta::specta]
fn update_config(pconfig: PublicConfig) -> CmdResult<()> {
    Ok(config::update_config(pconfig)?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();
    let mut builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        get_all_events,
        get_colors,
        get_tasklists,
        get_tasks,
        set_task,
        get_habits,
        complete_habit,
        get_weather,
        get_habit_history,
        get_config,
        update_config,
        quit
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default(),
            "/home/henryw/projects/dashboard/src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .setup(|app| {
            let config = config::get_config().unwrap_or_default();

            app.manage(GoogleClient::new(
                config.private.client_id,
                config.private.client_secret,
                config.public.refresh_token,
            ));

            let mhlist = Arc::new(Mutex::new(HabitList::get_from_file()?));
            app.manage(mhlist.clone());
            let spawn_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(60));
                loop {
                    interval.tick().await;
                    let mut habits = mhlist.lock().unwrap();

                    habits.check_all();

                    spawn_handle
                        .emit("habits-updated", habits.clone().habits)
                        .unwrap()
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
