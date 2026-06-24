use std::{collections::HashMap, fs, path::PathBuf};

use anyhow::{Context, Result};
use chrono::{DateTime, Local, Weekday};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Clone)]
#[serde(rename_all = "lowercase")]
pub enum HabitFrequency {
    Daily,
    Weekly,
}

#[derive(Serialize, Deserialize, Type, Clone)]
pub struct Habit {
    pub name: String,
    pub frequency: HabitFrequency,
    pub max: u8,
    pub amount: u8,
    pub timestamp: u32,
}

#[derive(Serialize, Deserialize, Type, Default, Clone)]
pub struct HabitList {
    pub habits: HashMap<String, Habit>,
}

#[derive(Serialize, Deserialize, Default, Type)]
pub struct Log {
    pub count: u8,
    pub max: u8,
}

pub type Logs = HashMap<String, Log>;

#[derive(Serialize, Deserialize, Type, Default)]
pub struct HabitLogs {
    pub daily: HashMap<i32, Logs>,
    pub weekly: HashMap<i32, Logs>,
}

impl Habit {
    pub fn check(&mut self) {
        let today = Local::now().date_naive();
        let date = DateTime::from_timestamp(self.timestamp as i64, 0).unwrap().date_naive();

        let expired = match self.frequency {
            HabitFrequency::Daily => today.to_epoch_days() > date.to_epoch_days(),
            HabitFrequency::Weekly => {
                    today.week(chrono::Weekday::Sun).checked_first_day().unwrap().to_epoch_days() 
                    > 
                    date.week(chrono::Weekday::Sun).checked_first_day().unwrap_or_default().to_epoch_days()
            }
        };

        if expired {
            self.amount = 0;
        }
    }

}

pub fn get_habit_file() -> Result<PathBuf> {Ok(ProjectDirs::from("com", "henryw", "dashboard").unwrap().data_dir().join("habits.toml"))}

pub fn get_log_file() -> Result<PathBuf> {Ok(ProjectDirs::from("com", "henryw", "dashboard").unwrap().data_dir().join("habitlog.json"))}

impl HabitList {
    pub fn get_from_file() -> Result<Self> {
    
        let habit_file = get_habit_file()?;

        if !habit_file.exists() {
            let default = Self::default();

            let toml_default = toml::to_string_pretty(&default).context("Failed to serialize default haibts")?;
    
            fs::write(&habit_file, toml_default).context("Failed to write default habits file")?;

            return Ok(default)
        }

        let contents = fs::read_to_string(&habit_file).context("Failed to read habit file")?;

        let mut toml_contents: HabitList = toml::from_str(&contents).context("Failed to deserialize habits")?;

        toml_contents.check_all();

        Ok(toml_contents)
    }

    fn write(&self) -> Result<()> {
        let habit_file = get_habit_file()?;

        let toml_habits = toml::to_string_pretty(&self).context("Failed to serialize habits")?;

        fs::write(&habit_file, toml_habits).context("Failed to write habits file")?;
        
        Ok(())
    }

    pub fn complete(&mut self, habit_name: &str) -> Result<()> {
        if let Some(habit) = self.habits.get_mut(habit_name) {
            if habit.amount < habit.max {
                habit.amount += 1;
                
                habit.timestamp = Local::now().timestamp() as u32;

                let _ = HabitLogs::get_from_file()?.log(habit, habit_name);

                let _ = self.write()?;
            }   
        }

        Ok(())
    }

    pub fn check_all(&mut self) {
        for (_item, habit) in self.habits.iter_mut() {
            habit.check();
        }

        let _ = self.write();
    }
}

impl HabitLogs {
    pub fn get_from_file() -> Result<Self> {
    
        let habit_file = get_log_file()?;

        if !habit_file.exists() {
            let default = Self::default();

            let json_default = serde_json::to_string_pretty(&default).context("Failed to serialize default habit logs")?;
    
            fs::write(&habit_file, json_default).context("Failed to write default habits log file")?;

            return Ok(default)
        }

        let contents = fs::read_to_string(&habit_file).context("Failed to read habit log file")?;

        let json_contents: HabitLogs = serde_json::from_str(&contents).context("Failed to deserialize habit logs")?;

        Ok(json_contents)
    }

    fn write(&self) -> Result<()> {
        let habit_file = get_log_file()?;

        let json_habits = serde_json::to_string_pretty(&self).context("Failed to serialize habit log file")?;

        fs::write(&habit_file, json_habits).context("Failed to write habit log file")?;
        
        Ok(())
    }

    pub fn log(&mut self, habit: &Habit, name: &str) -> Result<()> {
        let habit_date = DateTime::from_timestamp_secs(habit.timestamp as i64).context("Invalid timestamp")?.date_naive();

        let log = Log {
            count: habit.amount,
            max: habit.max
        };

        match habit.frequency {
            HabitFrequency::Daily => {
                if let Some(logs) = self.daily.get_mut(&habit_date.to_epoch_days()) {
                    logs.insert(name.to_string(), log);
                } else {
                    let mut habit_logs: HashMap<String, Log> = HashMap::new();

                    habit_logs.insert(name.to_string(), log);

                    self.daily.insert(habit_date.to_epoch_days(), habit_logs);
                }
            },
            HabitFrequency::Weekly => {
                if let Some(logs) = self.weekly.get_mut(&habit_date.week(Weekday::Sun).checked_first_day().unwrap().to_epoch_days()) {
                    logs.insert(name.to_string(), log);
                } else {
                    let mut habit_logs: HashMap<String, Log> = HashMap::new();
                    
                    habit_logs.insert(name.to_string(), log);

                    self.daily.insert(habit_date.to_epoch_days(), habit_logs);
                }
            }
        }

        self.write()?;

        Ok(())
    }
}
