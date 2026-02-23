//! MCP stdio server — JSON-RPC 2.0 over stdin/stdout.
//!
//! Launched via `app.exe --mcp`. This process has NO GUI.
//! It reads JSON-RPC requests from stdin, forwards them as HTTP
//! POST requests to the running AgentRef app (localhost:17532),
//! and writes JSON-RPC responses to stdout.

use serde_json::Value;
use std::io::{self, BufRead, Write};

use crate::mcp_http::MCP_HTTP_PORT;

const API_BASE: &str = "http://127.0.0.1";

fn api_url(path: &str) -> String {
    format!("{}:{}{}", API_BASE, MCP_HTTP_PORT, path)
}

fn http_post(path: &str, body: &Value) -> Result<Value, String> {
    match ureq::post(&api_url(path)).send_json(body) {
        Ok(resp) => {
            let body: Value = resp.into_json()
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            Ok(body)
        }
        Err(ureq::Error::Status(code, resp)) => {
            let body = resp.into_string().unwrap_or_default();
            Err(format!("HTTP {} — {}", code, body))
        }
        Err(e) => {
            Err(format!("Connection error: {} (is AgentRef running?)", e))
        }
    }
}

// --- Tool definitions ---

struct ToolDef {
    name: &'static str,
    description: &'static str,
    input_schema: Value,
    endpoint: &'static str,
}

fn get_tools() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "list_boards",
            description: "List all boards in an AgentRef project with item/group counts and type breakdown.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Absolute path to the .agentref project file. Optional if AgentRef app is running." }
                }
            }),
            endpoint: "/mcp/list_boards",
        },
        ToolDef {
            name: "get_board",
            description: "Get full details of a specific board including all items and groups.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Absolute path to .agentref file." },
                    "boardId": { "type": "string", "description": "Board ID (use list_boards to find IDs)." }
                },
                "required": ["boardId"]
            }),
            endpoint: "/mcp/get_board",
        },
        ToolDef {
            name: "get_active_board",
            description: "Get the board the user is currently working on with all items and groups. Uses live app state if available.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Optional if AgentRef app is running." }
                }
            }),
            endpoint: "/mcp/get_active_board",
        },
        ToolDef {
            name: "get_selection",
            description: "Get currently selected items in the running AgentRef app. Returns full item details. Requires AgentRef to be running.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Optional if AgentRef app is running." }
                }
            }),
            endpoint: "/mcp/get_selection",
        },
        ToolDef {
            name: "search_items",
            description: "Search for items across all boards by tag, rating, type, group, or free-text query. All filters use AND logic.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Absolute path to .agentref file." },
                    "tag": { "type": "string", "description": "Filter by tag (case-insensitive substring)." },
                    "rating": { "type": "number", "description": "Exact rating: 0=unrated, 1=trash, 2=keep, 3=star." },
                    "minRating": { "type": "number", "description": "Minimum rating (inclusive)." },
                    "type": { "type": "string", "enum": ["image", "video", "youtube", "text"], "description": "Filter by item type." },
                    "groupLabel": { "type": "string", "description": "Filter by group label (case-insensitive substring)." },
                    "boardId": { "type": "string", "description": "Limit search to a specific board." },
                    "query": { "type": "string", "description": "Free-text search across tags, group labels, and text content." }
                },
                "required": ["projectPath"]
            }),
            endpoint: "/mcp/search_items",
        },
        ToolDef {
            name: "add_items",
            description: "Add one or more items (images, text notes, videos, YouTube embeds) to a board.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string", "description": "Absolute path to .agentref file." },
                    "boardId": { "type": "string", "description": "Board ID to add items to." },
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": { "type": "string", "enum": ["image", "video", "youtube", "text"] },
                                "url": { "type": "string", "description": "URL, file path, or text content." },
                                "x": { "type": "number" },
                                "y": { "type": "number" },
                                "width": { "type": "number" },
                                "height": { "type": "number" },
                                "tags": { "type": "array", "items": { "type": "string" } },
                                "rating": { "type": "number", "minimum": 0, "maximum": 3 }
                            },
                            "required": ["type", "url"]
                        },
                        "minItems": 1
                    }
                },
                "required": ["projectPath", "boardId", "items"]
            }),
            endpoint: "/mcp/add_items",
        },
        ToolDef {
            name: "move_items",
            description: "Move, resize, or rotate items on a board. Supports batch operations.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "boardId": { "type": "string" },
                    "changes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "itemId": { "type": "string" },
                                "x": { "type": "number" },
                                "y": { "type": "number" },
                                "width": { "type": "number" },
                                "height": { "type": "number" },
                                "rotation": { "type": "number" }
                            },
                            "required": ["itemId"]
                        },
                        "minItems": 1
                    }
                },
                "required": ["projectPath", "boardId", "changes"]
            }),
            endpoint: "/mcp/move_items",
        },
        ToolDef {
            name: "tag_items",
            description: "Add/remove tags and set ratings on items. Rating scale: 0=unrated, 1=trash, 2=keep, 3=star.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "boardId": { "type": "string" },
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "itemId": { "type": "string" },
                                "addTags": { "type": "array", "items": { "type": "string" } },
                                "removeTags": { "type": "array", "items": { "type": "string" } },
                                "rating": { "type": "number", "minimum": 0, "maximum": 3 }
                            },
                            "required": ["itemId"]
                        },
                        "minItems": 1
                    }
                },
                "required": ["projectPath", "boardId", "operations"]
            }),
            endpoint: "/mcp/tag_items",
        },
        ToolDef {
            name: "delete_items",
            description: "Delete items from a board by their IDs.",
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "boardId": { "type": "string" },
                    "itemIds": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
                },
                "required": ["projectPath", "boardId", "itemIds"]
            }),
            endpoint: "/mcp/delete_items",
        },
    ]
}

// --- JSON-RPC helpers ---

fn jsonrpc_response(id: &Value, result: Value) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    })
}

fn jsonrpc_error(id: &Value, code: i64, message: &str) -> Value {
    serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    })
}

fn mcp_text(text: &str) -> Value {
    serde_json::json!({
        "content": [{ "type": "text", "text": text }]
    })
}

fn mcp_error_text(text: &str) -> Value {
    serde_json::json!({
        "content": [{ "type": "text", "text": text }],
        "isError": true
    })
}

// --- Main entry point ---

pub fn run_mcp_server() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    eprintln!("[AgentRef MCP] stdio server started (forwarding to http://127.0.0.1:{})", MCP_HTTP_PORT);

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l.trim().to_string(),
            Err(_) => break,
        };
        if line.is_empty() { continue; }

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                let err = jsonrpc_error(&Value::Null, -32700, &format!("Parse error: {}", e));
                let _ = writeln!(stdout, "{}", serde_json::to_string(&err).unwrap());
                let _ = stdout.flush();
                continue;
            }
        };

        let id = request.get("id").cloned().unwrap_or(Value::Null);
        let method = request.get("method").and_then(|v| v.as_str()).unwrap_or("");

        let response = match method {
            "initialize" => {
                jsonrpc_response(&id, serde_json::json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "agentref",
                        "version": "0.2.0"
                    }
                }))
            }

            "notifications/initialized" => {
                // No response needed for notifications
                continue;
            }

            "tools/list" => {
                let tools: Vec<Value> = get_tools().iter().map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema
                    })
                }).collect();
                jsonrpc_response(&id, serde_json::json!({ "tools": tools }))
            }

            "tools/call" => {
                let params = request.get("params").cloned().unwrap_or(Value::Object(Default::default()));
                let tool_name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let arguments = params.get("arguments").cloned().unwrap_or(Value::Object(Default::default()));

                let tools = get_tools();
                match tools.iter().find(|t| t.name == tool_name) {
                    None => {
                        jsonrpc_response(&id, mcp_error_text(&format!("Unknown tool: {}", tool_name)))
                    }
                    Some(tool) => {
                        match http_post(tool.endpoint, &arguments) {
                            Ok(result) => {
                                let text = serde_json::to_string_pretty(&result).unwrap_or_default();
                                jsonrpc_response(&id, mcp_text(&text))
                            }
                            Err(e) => {
                                jsonrpc_response(&id, mcp_error_text(&e))
                            }
                        }
                    }
                }
            }

            _ => {
                jsonrpc_error(&id, -32601, &format!("Method not found: {}", method))
            }
        };

        let _ = writeln!(stdout, "{}", serde_json::to_string(&response).unwrap());
        let _ = stdout.flush();
    }
}
