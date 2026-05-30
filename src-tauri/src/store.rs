use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type)]
pub enum HabitFrequency {
    Daily,
    Weekly,
}

#[derive(Serialize, Deserialize, Type)]
pub struct Habit {
    pub name: String,
    pub frequency: HabitFrequency,
    pub amount: u8,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Type)]
pub struct HabitList {
    pub habits: HashMap<String, Habit>,
}
