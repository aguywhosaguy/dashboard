use anyhow::{Context, Ok, Result};
use chrono::{Local, Weekday};
use reqwest::{Client, Method, RequestBuilder};
use serde::{Serialize, Deserialize};
use specta::Type;
use tokio::sync::OnceCell;
use std::{time::{Duration, Instant}};
use tauri::{async_runtime::RwLock, http::response};
use std::collections::HashMap;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug)]
struct CachedToken {
    token: String,
    expires_at: Instant,
}

impl CachedToken {
    fn is_expired(&self) -> bool {
        Instant::now() + Duration::from_secs(10) >= self.expires_at
    }
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleDate {
    date: Option<String>,
    dateTime: Option<String>,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleEvent {
    pub summary: String,
    pub description: Option<String>,
    pub id: String,
    pub start: GoogleDate,
    pub end: GoogleDate,
    pub htmlLink: String,
    pub colorId: Option<String>,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleCalendar {
    pub id: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleCalendarList {
    pub items: Vec<GoogleCalendar>,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleEventList {
    pub items: Vec<GoogleEvent>,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct GoogleColor {
    pub background: String,
    pub foreground: String,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct GoogleColorList {
    pub calendar: HashMap<String, GoogleColor>,
    pub event: HashMap<String, GoogleColor>,
}

#[derive(Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum GoogleTaskStatus {
    NeedsAction,
    Completed,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleTask {
    pub id: String,
    pub title: String,
    pub status: GoogleTaskStatus,
    pub selfLink: String,
}

#[derive(Serialize, Deserialize, Type)]
pub struct GoogleTasks {
    pub items: Vec<GoogleTask>,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct GoogleTasklist {
    pub title: String,
    pub id: String,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct GoogleTasklists {
    pub items: Vec<GoogleTasklist>,
}

pub struct GoogleClient {
    client: Client,
    client_id: String,
    client_secret: String,
    refresh_token: String,
    token_cache: RwLock<Option<CachedToken>>,
    colors: tokio::sync::OnceCell<GoogleColorList>,
    tasklists: tokio::sync::OnceCell<Vec<GoogleTasklist>>
}

impl GoogleClient {
    pub fn from_env() -> Result<Self> {
        let client_id = std::env::var("CLIENT_ID").context("Missing client ID")?;

        let client_secret = std::env::var("CLIENT_SECRET").context("Missing client secret")?;

        let refresh_token = std::env::var("REFRESH_TOKEN").context("Missing refresh token")?;

        Ok(Self {
            client: Client::new(),
            client_id,
            client_secret,
            refresh_token,
            token_cache: RwLock::new(None),
            colors: OnceCell::new(),
            tasklists: OnceCell::new(),
        })
    }

    pub fn new(client_id: String, client_secret: String, refresh_token: String) -> Self {
        Self {
            client: Client::new(),
            client_id,
            client_secret,
            refresh_token,
            token_cache: RwLock::new(None),
            colors: OnceCell::new(),
            tasklists: OnceCell::new(),
        }
    }

    async fn get_token(&self) -> Result<String> {
        {
            let cache = self.token_cache.read().await;
            if let Some(cached) = &*cache {
                if !cached.is_expired() {
                    return Ok(cached.token.clone());
                }
            }
        }

        let mut cache = self.token_cache.write().await;

        let url = "https://oauth2.googleapis.com/token";
        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("refresh_token", self.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ];

        let response = self
            .client
            .post(url)
            .form(&params)
            .send()
            .await
            .context("Failed to request token refresh from Google")?;

        if !response.status().is_success() {
            let status = response.status();
            let err_body = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".into());
            return Err(
                anyhow::anyhow!("Google OAuth refresh failed ({status}): {err_body}").into(),
            );
        }

        let token_data: TokenResponse = response
            .json()
            .await
            .context("Failed to parse Google token response JSON")?;

        let access_token = token_data.access_token.clone();

        *cache = Some(CachedToken {
            token: token_data.access_token,
            expires_at: Instant::now() + Duration::from_secs(token_data.expires_in),
        });

        Ok(access_token)
    }

    async fn request(&self, method: Method, url: &str) -> Result<RequestBuilder> {
        let token = self.get_token().await?;

        Ok(self.client.request(method, url).bearer_auth(token))
    }

    pub async fn get_events(&self, calendar: &str) -> Result<Vec<GoogleEvent>> {

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

        let response = self
            .request(
                Method::GET,
                format!(
                    "https://www.googleapis.com/calendar/v3/calendars/{}/events",
                    calendar
                )
                .as_str(),
            )
            .await?
            .query(&[("timeMin", sunday), ("timeMax", saturday), ("singleEvents", "true".to_string())])
            .send()
            .await
            .context("Failed to send request")?;

        let events: GoogleEventList = response.json().await.context("Failed to parse response")?;

        Ok(events.items)
    }

    pub async fn get_calendars(&self) -> Result<Vec<GoogleCalendar>> {
        let response = self
            .request(Method::GET, "https://www.googleapis.com/calendar/v3/users/me/calendarList")
            .await?
            .send()
            .await
            .context("Failed to get calendars")?;

        let calendars: GoogleCalendarList = response.json().await.context("Failed to parse calendar list")?;
        
        Ok(calendars.items)
    }

    pub async fn get_colors(&self) -> Result<GoogleColorList> {
        Ok(self.colors.get_or_try_init(|| async {
            let response = self
                .request(Method::GET, "https://www.googleapis.com/calendar/v3/colors")
                .await?
                .send()
                .await
                .context("Failed to get colors")?;

            let colors: GoogleColorList = response.json().await.context("Failed to parse color list")?;

            Ok(colors)
        }).await?.clone())
    }
    pub async fn get_tasklists(&self) -> Result<Vec<GoogleTasklist>> {
        Ok(self.tasklists.get_or_try_init(|| async {
            let response = self
                .request(Method::GET, "https://tasks.googleapis.com/tasks/v1/users/@me/lists")
                .await?
                .send()
                .await
                .context("Failed to get tasklists")?;

            let tasklists: GoogleTasklists = response.json().await.context("Failed to parse tasklists")?;

            Ok(tasklists.items)
        }).await?.clone())
    }

    pub async fn get_tasks(&self, tasklist: GoogleTasklist) -> Result<Vec<GoogleTask>> {
        let response = self
            .request(
                Method::GET, 
                format!("https://tasks.googleapis.com/tasks/v1/lists/{}/tasks", &tasklist.id.as_str()).as_str()
            )
            .await?
            .send()
            .await
            .context("Failed to get tasks")?;

        let tasks: GoogleTasks = response.json().await.context("Failed to parse tasks")?;

        Ok(tasks.items)
    }

    pub async fn set_task(&self, task: GoogleTask) -> Result<GoogleTask> {
        let response = self
            .request(
                Method::PATCH, 
                &task.selfLink
            )
            .await?
            .body(serde_json::to_string(&task).context("Failed to serialize task")?)
            .send()
            .await
            .context("Failed to update task")?;

        let updated_task: GoogleTask = response.json().await.context("Failed to parse updated task")?;

        Ok(updated_task)
    }
}
