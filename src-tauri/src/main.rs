// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--mcp") {
        // Run as headless MCP stdio server (no GUI).
        // Forwards JSON-RPC tool calls to the running AgentRef app's HTTP API.
        app_lib::mcp_stdio::run_mcp_server();
    } else {
        // Run normal GUI app (includes embedded MCP HTTP API on localhost)
        app_lib::run();
    }
}
