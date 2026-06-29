use serde::{Deserialize, Serialize};

use directories::ProjectDirs;

use std::fs;

use anyhow::{Context, Result};

#[derive(specta::Type, Serialize, Deserialize, Default)]
pub struct PrivateConfig {
    pub weather_key: String
}

#[derive(specta::Type, Serialize, Deserialize, Default)]
pub struct PublicConfig {
    pub location: String,
    pub refresh_token: String,
}

#[derive(specta::Type, Serialize, Deserialize, Default)]
pub struct Config {
    pub public: PublicConfig,
    pub private: PrivateConfig
}

pub fn get_config() -> Result<Config> {
    let proj = ProjectDirs::from("com", "henryw", "dashboard").context("Could not find config directory")?;

    let cdir = proj.config_dir();
    fs::create_dir_all(cdir).context("Could not create config directory")?;

    let cfile = cdir.join("config.toml");

    let ddir = proj.data_dir();
    fs::create_dir_all(ddir).context("Could not create data directory")?;

    if !cfile.exists() {
        let default = Config::default(); 

        let toml_string =
            toml::to_string_pretty(&default).context("Failed to serialize default config")?;

        fs::write(&cfile, toml_string).context("Failed to write config")?;

        return Ok(default);
    }

    let contents =
        fs::read_to_string(&cfile).with_context(|| format!("Failed to read {cfile:?}"))?;

    let config: Config = toml::from_str(&contents).context("Config file was not valid toml")?;

    Ok(config)
}

pub fn update_config(pconfig: PublicConfig) -> Result<()> {
    let mut config = get_config()?;

    config.public = pconfig;

    
    let proj = ProjectDirs::from("com", "henryw", "dashboard").context("Could not find config directory")?;

    let cdir = proj.config_dir();
    let cfile = cdir.join("config.toml");
    
    let toml_string = toml::to_string_pretty(&config).context("Failed to serialize new config")?;

    fs::write(&cfile, toml_string).context("Failed to write new config")?;

    Ok(())
}

