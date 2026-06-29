use anyhow::{Context, Result};
use serde::{Serialize, Deserialize};

use specta::Type;

use crate::config::get_config;

#[derive(Serialize, Deserialize, Type)]
pub struct Weather {
    time: u32,
    interval: u32,
    relative_humidity_2m: f32,
    temperature_2m: f32,
    apparent_temperature: f32,
    is_day: u8,
    precipitation: f32,
    rain: f32,
    weather_code: u32,
    wind_speed_10m: f32
}

#[derive(Serialize, Deserialize, Type)]
pub struct Forecast {
    time: [u32; 3],
    temperature_2m_max: [f32; 3],
    temperature_2m_min: [f32; 3]
}

#[derive(Serialize, Deserialize)]
pub struct WeatherResponse {
    current: Weather,
    daily: Forecast
}

#[derive(Serialize, Deserialize, Type)]
pub struct LocationWeather {
    location: String,
    current: Weather,
    daily: Forecast
}

#[derive(Serialize, Deserialize)]
pub struct Geocode {
    lat: f32,
    lon: f32,
    name: String
}


impl LocationWeather {
    #[allow(dead_code)]
    pub async fn from_lat_long(latitude: f32, longitude: f32) -> Result<Self> {
        let response = reqwest::Client::new()
            .request(
                reqwest::Method::GET, 
                "http://api.openweathermap.org/geo/1.0/reverse"
            )
            .query(&[
                ("lat", latitude.to_string()),
                ("lon", longitude.to_string()),
                ("limit", "1".to_string()),
                ("appid", get_config()?.private.weather_key)
            ])
            .send()
            .await
            .context("Failed to get location")?;

        let location_response: Vec<Geocode> = response.json().await.context("Failed to serialize geocode data")?;

        let weather: WeatherResponse = WeatherResponse::get_weather(latitude, longitude).await?;
        
        Ok(Self {
            location: location_response
                .get(0)
                .map(|geo| geo.name.clone())
                .unwrap_or("Unknown".to_string()),
            current: weather.current,
            daily: weather.daily
        })
    }

    pub async fn from_location(location: String) -> Result<LocationWeather> {
        let response = reqwest::Client::new()
            .request(
                reqwest::Method::GET, 
                "http://api.openweathermap.org/geo/1.0/direct"
            )
            .query(&[
                ("q", location),
                ("limit", "1".to_string()),
                ("appid", get_config()?.private.weather_key)
            ])
            .send()
            .await
            .context("Failed to get coordinates")?;

        let location_response: Vec<Geocode> = response.json().await.context("Failed to serialize geocode data")?;

        let weather: WeatherResponse = WeatherResponse::get_weather(
            location_response
                .get(0)
                .map(|geo| geo.lat.clone())
                .unwrap_or(0.0),
            location_response
                .get(0)
                .map(|geo| geo.lon.clone())
                .unwrap_or(0.0)

        ).await?;

        Ok(Self {
            location: location_response
                .get(0)
                .map(|geo| geo.name.clone())
                .unwrap_or("Unknown".to_string()),
            current: weather.current,
            daily: weather.daily
        })
    }

}

impl WeatherResponse {
    async fn get_weather(lat: f32, lon: f32) -> Result<Self> {
        let current = [
            "relative_humidity_2m",
            "temperature_2m",
            "apparent_temperature",
            "is_day",
            "precipitation",
            "rain",
            "weather_code",
            "wind_speed_10m"
        ];

        let daily = [
            "temperature_2m_max",
            "temperature_2m_min"
        ];

        let settings: [(&str, String); _] = [
            ("wind_speed_unit", "mph".to_string()),
            ("precipitation_unit", "inch".to_string()),
            ("temperature_unit", "fahrenheit".to_string()),
            ("current", current.join(",")),
            ("daily", daily.join(",")),
            ("latitude", lat.to_string()),
            ("longitude", lon.to_string()),
            ("timezone", "America/Chicago".to_string()),
            ("forecast_days", "3".to_string()),
            ("timeformat", "unixtime".to_string())
        ];


        let response = reqwest::Client::new()
            .request(
                reqwest::Method::GET, 
                "https://api.open-meteo.com/v1/forecast"
            )
            .query(
                &settings
            )
            .send()
            .await
            .context("Failed to get weather")?;

        let weather_response: WeatherResponse = response.json().await.context("Failed to serialize weather data")?;

        Ok(weather_response)
    }
}
