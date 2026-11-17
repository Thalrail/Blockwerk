// Blockwerk – Windows-Rahmen. Keine eigene Logik: das Fenster zeigt die Weboberfläche aus windows/dist.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Blockwerk konnte nicht gestartet werden");
}
