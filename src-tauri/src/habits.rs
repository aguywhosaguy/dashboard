use std::{collections::HashMap, fs, path::{Path, PathBuf}};

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Local};
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

        println!("{}", &contents);

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

    pub fn complete(&mut self, habit_name: &str) {
        if let Some(habit) = self.habits.get_mut(habit_name) {
            if habit.amount < habit.max {
                habit.amount += 1;
                
                habit.timestamp = Local::now().timestamp() as u32;

                self.write();
            }       

        }
    }

    pub fn check_all(&mut self) {
        for (_item, habit) in self.habits.iter_mut() {
            habit.check();
        }

        self.write();
    }
}
