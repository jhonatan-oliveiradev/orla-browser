use std::{fs, io::{self, Write}, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Clone, Serialize, Deserialize)]
pub struct Progress {
    pub id: u32,
    pub name: String,
    pub received: i64,
    pub total: i64,
    pub state: String,
}

#[derive(Serialize, Deserialize)]
struct Record {
    progress: Progress,
    path: PathBuf,
}

pub struct Store {
    file: PathBuf,
    records: Vec<Record>,
    next_id: u32,
}

impl Store {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let file = app.path().app_local_data_dir().map_err(|error| error.to_string())?.join("downloads-v1.json");
        let mut records: Vec<Record> = match fs::read(&file) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| error.to_string())?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(error.to_string()),
        };
        let next_id = records.iter().map(|record| record.progress.id).max().unwrap_or(0).wrapping_add(1);
        for record in &mut records {
            if record.progress.state == "running" { record.progress.state = "interrupted".into(); }
        }
        Ok(Self { file, records, next_id })
    }

    pub fn allocate(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);
        id
    }

    pub fn list(&self) -> Vec<Progress> {
        self.records.iter().map(|record| record.progress.clone()).collect()
    }

    pub fn completed_path(&self, id: u32) -> Option<PathBuf> {
        self.records.iter().find(|record| record.progress.id == id && record.progress.state == "completed")
            .map(|record| record.path.clone())
    }

    pub fn record(&mut self, progress: &Progress, path: PathBuf) -> io::Result<()> {
        let record = Record { progress: progress.clone(), path };
        if let Some(index) = self.records.iter().position(|item| item.progress.id == progress.id) {
            if progress.state == "running" { return Ok(()); }
            self.records[index] = record;
        } else {
            self.records.push(record);
        }
        while self.records.len() > 100 {
            let Some(index) = self.records.iter().position(|item| item.progress.state != "running") else { break };
            self.records.remove(index);
        }
        let temporary = self.file.with_extension("tmp");
        let mut file = fs::File::create(&temporary)?;
        serde_json::to_writer(&mut file, &self.records)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        fs::rename(temporary, &self.file)
    }
}
