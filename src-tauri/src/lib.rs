use std::process::{Command, Child};
use std::sync::Mutex;
use std::time::Duration;
use std::thread;
use std::net::TcpStream;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

fn wait_for_server(timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect("127.0.0.1:3000").is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            // Start Next.js dev server
            let child = Command::new("npm")
                .args(["run", "dev"])
                .current_dir(env!("CARGO_MANIFEST_DIR").to_string() + "/..")
                .spawn()
                .expect("Failed to start Next.js dev server");

            _app.manage(ServerProcess(Mutex::new(Some(child))));

            // Wait for server to be ready
            println!("Waiting for Next.js server...");
            if wait_for_server(Duration::from_secs(30)) {
                println!("Next.js server is ready!");
            } else {
                eprintln!("Warning: Next.js server did not respond within 30s");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
