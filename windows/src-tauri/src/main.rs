// Blockwerk – Windows-Rahmen. Das Fenster zeigt die Weboberfläche aus windows/dist.
// Einzige eigene Funktion: „Speichern unter“ für Projektdateien (die Oberfläche ruft `speichere_datei` nur in dieser Anwendung auf).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_dialog::DialogExt;

/// Höchste Dateigröße (Schutz vor Unsinn; echte Projektdateien sind wenige hundert KB).
const MAX_BYTES: usize = 64 * 1024 * 1024;

/// Öffnet den Windows-Dialog „Speichern unter“ und schreibt den Text genau in die dort gewählte Datei.
/// Gibt den Pfad zurück, oder `None`, wenn der Benutzer abbricht. Schreibt nie ohne Dialog und nie anderswohin.
#[tauri::command]
async fn speichere_datei(app: tauri::AppHandle, vorschlag: String, text: String) -> Result<Option<String>, String> {
    if text.len() > MAX_BYTES {
        return Err("Die Projektdatei ist zu groß.".into());
    }
    let name: String = vorschlag
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(100)
        .collect();
    let gewaehlt = app
        .dialog()
        .file()
        .set_title("Blockwerk-Projekt sichern")
        .set_file_name(if name.is_empty() { "blockwerk.blockwerk.json" } else { &name })
        .add_filter("Blockwerk-Projekt (*.json)", &["json"])
        .blocking_save_file();
    let Some(pfad) = gewaehlt else { return Ok(None) };
    let pfad = pfad.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&pfad, text).map_err(|e| format!("{}: {e}", pfad.display()))?;
    Ok(Some(pfad.display().to_string()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![speichere_datei])
        .run(tauri::generate_context!())
        .expect("Blockwerk konnte nicht gestartet werden");
}
