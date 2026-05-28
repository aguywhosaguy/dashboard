use anyhow::{Context, Result};
use reqwest::{Client, Method, RequestBuilder};
use serde::Deserialize;
use std::time::{Duration, Instant};
use tauri::async_runtime::RwLock;

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

pub struct GoogleClient {
    client: Client,
    client_id: String,
    client_secret: String,
    refresh_token: String,
    token_cache: RwLock<Option<CachedToken>>,
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
        })
    }

    pub fn new(client_id: String, client_secret: String, refresh_token: String) -> Self {
        Self {
            client: Client::new(),
            client_id,
            client_secret,
            refresh_token,
            token_cache: RwLock::new(None),
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

    pub async fn request(&self, method: Method, url: &str) -> Result<RequestBuilder> {
        let token = self.get_token().await?;

        Ok(self.client.request(method, url).bearer_auth(token))
    }
}
