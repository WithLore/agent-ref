//! HTTP API server for MCP integration.
//!
//! Runs inside the Tauri app on localhost:17532.
//! The MCP stdio proxy (app.exe --mcp) forwards tool calls here.
//! This module reads/writes .agentref project files and emits
//! Tauri events to the frontend for live state synchronization.

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub const MCP_HTTP_PORT: u16 = 17532;

/// Shared state for the HTTP server.
#[derive(Clone)]
pub struct McpHttpState {
    pub app_handle: AppHandle,
}

// --- Project file I/O helpers ---

fn read_project(path: &str) -> Result<Value, String> {
    if !Path::new(path).exists() {
        return Err(format!("Project file not found: {}", path));
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project JSON: {}", e))
}

fn write_project(path: &str, data: &Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write project file: {}", e))
}

fn read_live_state() -> Option<Value> {
    let home = dirs_next().ok()?;
    let path = home.join(".agentref").join("live-state.json");
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn dirs_next() -> Result<std::path::PathBuf, ()> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE")
            .map(std::path::PathBuf::from)
            .map_err(|_| ())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME")
            .map(std::path::PathBuf::from)
            .map_err(|_| ())
    }
}

fn resolve_project_path(explicit: Option<&str>) -> Result<String, String> {
    if let Some(p) = explicit {
        if !p.is_empty() {
            return Ok(p.to_string());
        }
    }
    // Fall back to live state
    if let Some(live) = read_live_state() {
        if let Some(p) = live.get("projectPath").and_then(|v| v.as_str()) {
            if !p.is_empty() {
                return Ok(p.to_string());
            }
        }
    }
    Err("No project path provided and no running AgentRef app detected.".into())
}

fn find_board<'a>(project: &'a Value, board_id: &str) -> Result<&'a Value, String> {
    let boards = project.get("boards")
        .and_then(|b| b.as_array())
        .ok_or("Project has no boards")?;
    boards.iter()
        .find(|b| b.get("id").and_then(|v| v.as_str()) == Some(board_id))
        .ok_or(format!("Board not found: {}", board_id))
}

fn find_board_mut<'a>(project: &'a mut Value, board_id: &str) -> Result<&'a mut Value, String> {
    let boards = project.get_mut("boards")
        .and_then(|b| b.as_array_mut())
        .ok_or("Project has no boards")?;
    boards.iter_mut()
        .find(|b| b.get("id").and_then(|v| v.as_str()) == Some(board_id))
        .ok_or(format!("Board not found: {}", board_id))
}

fn get_board_items(board: &Value) -> Vec<Value> {
    board.get("items")
        .and_then(|i| i.as_array())
        .cloned()
        .unwrap_or_default()
}

fn enrich_item(item: &Value, board: &Value) -> Value {
    let mut enriched = item.clone();
    // Add group label if grouped
    if let Some(group_id) = item.get("groupId").and_then(|v| v.as_str()) {
        if let Some(groups) = board.get("groups").and_then(|g| g.as_array()) {
            for group in groups {
                if group.get("id").and_then(|v| v.as_str()) == Some(group_id) {
                    enriched["groupLabel"] = group.get("label")
                        .cloned()
                        .unwrap_or(Value::String("Group".into()));
                    break;
                }
            }
        }
    }
    // Add rating label
    let rating = item.get("rating").and_then(|v| v.as_u64()).unwrap_or(0);
    enriched["ratingLabel"] = Value::String(match rating {
        1 => "trash".into(),
        2 => "keep".into(),
        3 => "star".into(),
        _ => "unrated".into(),
    });
    enriched
}

// --- Route handlers ---

async fn handle_health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok", "server": "agentref", "version": "0.2.0" }))
}

async fn handle_list_boards(
    State(_state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    match resolve_project_path(project_path) {
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(project) => {
                let boards = project.get("boards")
                    .and_then(|b| b.as_array())
                    .cloned()
                    .unwrap_or_default();
                let board_summaries: Vec<Value> = boards.iter().map(|b| {
                    let items = get_board_items(b);
                    let mut by_type = serde_json::json!({});
                    for item in &items {
                        let t = item.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
                        let count = by_type.get(t).and_then(|v| v.as_u64()).unwrap_or(0);
                        by_type[t] = Value::Number((count + 1).into());
                    }
                    let groups = b.get("groups").and_then(|g| g.as_array()).map(|g| g.len()).unwrap_or(0);
                    serde_json::json!({
                        "id": b.get("id"),
                        "name": b.get("name"),
                        "itemCount": items.len(),
                        "groupCount": groups,
                        "itemsByType": by_type,
                        "createdAt": b.get("createdAt"),
                        "modifiedAt": b.get("modifiedAt"),
                    })
                }).collect();
                (StatusCode::OK, Json(serde_json::json!({
                    "success": true,
                    "projectName": project.get("name"),
                    "projectId": project.get("id"),
                    "boardCount": board_summaries.len(),
                    "boards": board_summaries
                })))
            }
        }
    }
}

async fn handle_get_board(
    State(_state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let board_id = req.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    match resolve_project_path(project_path) {
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(project) => match find_board(&project, board_id) {
                Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                Ok(board) => {
                    let items: Vec<Value> = get_board_items(board).iter()
                        .map(|item| enrich_item(item, board))
                        .collect();
                    let groups = board.get("groups").cloned().unwrap_or(Value::Array(vec![]));
                    (StatusCode::OK, Json(serde_json::json!({
                        "success": true,
                        "board": {
                            "id": board.get("id"),
                            "name": board.get("name"),
                            "createdAt": board.get("createdAt"),
                            "modifiedAt": board.get("modifiedAt"),
                            "itemCount": items.len(),
                            "groups": groups,
                            "items": items,
                        }
                    })))
                }
            }
        }
    }
}

async fn handle_get_active_board(
    State(_state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    match resolve_project_path(project_path) {
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(project) => {
                // Use live state for active board ID if available
                let live = read_live_state();
                let live_board_id = live.as_ref()
                    .and_then(|l| l.get("activeBoardId"))
                    .and_then(|v| v.as_str());
                let saved_board_id = project.get("activeBoardId")
                    .and_then(|v| v.as_str());
                let board_id = live_board_id.or(saved_board_id).unwrap_or("");

                match find_board(&project, board_id) {
                    Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        let items: Vec<Value> = get_board_items(board).iter()
                            .map(|item| enrich_item(item, board))
                            .collect();
                        let groups = board.get("groups").cloned().unwrap_or(Value::Array(vec![]));
                        let app_running = live.is_some();
                        (StatusCode::OK, Json(serde_json::json!({
                            "success": true,
                            "appRunning": app_running,
                            "board": {
                                "id": board.get("id"),
                                "name": board.get("name"),
                                "createdAt": board.get("createdAt"),
                                "modifiedAt": board.get("modifiedAt"),
                                "itemCount": items.len(),
                                "groups": groups,
                                "items": items,
                            }
                        })))
                    }
                }
            }
        }
    }
}

async fn handle_get_selection(
    State(_state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let live = read_live_state();
    let app_running = live.is_some();

    let selected_ids: Vec<String> = live.as_ref()
        .and_then(|l| l.get("selectedIds"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    if selected_ids.is_empty() {
        return (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "appRunning": app_running,
            "selectedCount": 0,
            "items": []
        })));
    }

    match resolve_project_path(project_path) {
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(project) => {
                let live_board_id = live.as_ref()
                    .and_then(|l| l.get("activeBoardId"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                match find_board(&project, live_board_id) {
                    Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        let items: Vec<Value> = get_board_items(board).iter()
                            .filter(|item| {
                                item.get("id").and_then(|v| v.as_str())
                                    .map(|id| selected_ids.contains(&id.to_string()))
                                    .unwrap_or(false)
                            })
                            .map(|item| enrich_item(item, board))
                            .collect();
                        (StatusCode::OK, Json(serde_json::json!({
                            "success": true,
                            "appRunning": app_running,
                            "activeBoardId": live_board_id,
                            "activeBoardName": board.get("name"),
                            "selectedCount": items.len(),
                            "items": items
                        })))
                    }
                }
            }
        }
    }
}

async fn handle_search_items(
    State(_state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    match resolve_project_path(project_path) {
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(project) => {
                let tag_filter = req.get("tag").and_then(|v| v.as_str()).map(|s| s.to_lowercase());
                let type_filter = req.get("type").and_then(|v| v.as_str());
                let rating_filter = req.get("rating").and_then(|v| v.as_u64());
                let min_rating = req.get("minRating").and_then(|v| v.as_u64());
                let query = req.get("query").and_then(|v| v.as_str()).map(|s| s.to_lowercase());
                let board_filter = req.get("boardId").and_then(|v| v.as_str());
                let group_label_filter = req.get("groupLabel").and_then(|v| v.as_str()).map(|s| s.to_lowercase());

                let boards = project.get("boards").and_then(|b| b.as_array()).cloned().unwrap_or_default();
                let mut matches: Vec<Value> = vec![];

                for board in &boards {
                    let bid = board.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    if let Some(bf) = board_filter {
                        if bid != bf { continue; }
                    }
                    let bname = board.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    for item in get_board_items(board) {
                        // Tag filter
                        if let Some(ref tf) = tag_filter {
                            let tags = item.get("tags").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                            let has_tag = tags.iter().any(|t| t.as_str().map(|s| s.to_lowercase().contains(tf)).unwrap_or(false));
                            if !has_tag { continue; }
                        }
                        // Type filter
                        if let Some(tf) = type_filter {
                            if item.get("type").and_then(|v| v.as_str()) != Some(tf) { continue; }
                        }
                        // Rating filter
                        if let Some(rf) = rating_filter {
                            if item.get("rating").and_then(|v| v.as_u64()).unwrap_or(0) != rf { continue; }
                        }
                        // Min rating filter
                        if let Some(mr) = min_rating {
                            if item.get("rating").and_then(|v| v.as_u64()).unwrap_or(0) < mr { continue; }
                        }
                        // Group label filter
                        if let Some(ref glf) = group_label_filter {
                            let enriched = enrich_item(&item, board);
                            let gl = enriched.get("groupLabel").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                            if !gl.contains(glf) { continue; }
                        }
                        // Free text query
                        if let Some(ref q) = query {
                            let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                            let tags = item.get("tags").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                            let tags_str: String = tags.iter().filter_map(|t| t.as_str()).collect::<Vec<_>>().join(" ").to_lowercase();
                            let enriched = enrich_item(&item, board);
                            let gl = enriched.get("groupLabel").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                            if !url.contains(q) && !tags_str.contains(q) && !gl.contains(q) { continue; }
                        }

                        matches.push(serde_json::json!({
                            "boardId": bid,
                            "boardName": bname,
                            "item": enrich_item(&item, board)
                        }));
                        if matches.len() >= 100 { break; }
                    }
                    if matches.len() >= 100 { break; }
                }

                let total = matches.len();
                (StatusCode::OK, Json(serde_json::json!({
                    "success": true,
                    "matchCount": total,
                    "returnedCount": total,
                    "truncated": total >= 100,
                    "matches": matches
                })))
            }
        }
    }
}

async fn handle_add_items(
    State(state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let board_id = req.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let items_to_add = req.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    if items_to_add.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": "No items to add" })));
    }

    match resolve_project_path(project_path) {
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(mut project) => {
                match find_board_mut(&mut project, board_id) {
                    Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        // Ensure items array exists
                        if board.get("items").and_then(|v| v.as_array()).is_none() {
                            board["items"] = Value::Array(vec![]);
                        }

                        let mut added_ids = vec![];
                        let max_z = board.get("items")
                            .and_then(|v| v.as_array())
                            .unwrap()
                            .iter()
                            .filter_map(|it| it.get("zIndex").and_then(|v| v.as_i64()))
                            .max()
                            .unwrap_or(0);

                        // Build new items
                        let mut new_items = vec![];
                        for (i, spec) in items_to_add.iter().enumerate() {
                            let id = uuid::Uuid::new_v4().to_string();
                            let item_type = spec.get("type").and_then(|v| v.as_str()).unwrap_or("image");
                            let is_video = item_type == "video" || item_type == "youtube";
                            let new_item = serde_json::json!({
                                "id": id,
                                "type": item_type,
                                "url": spec.get("url").and_then(|v| v.as_str()).unwrap_or(""),
                                "x": spec.get("x").and_then(|v| v.as_f64()).unwrap_or(i as f64 * 20.0),
                                "y": spec.get("y").and_then(|v| v.as_f64()).unwrap_or(i as f64 * 20.0),
                                "width": spec.get("width").and_then(|v| v.as_f64()).unwrap_or(if is_video { 480.0 } else { 300.0 }),
                                "height": spec.get("height").and_then(|v| v.as_f64()).unwrap_or(if is_video { 270.0 } else { 200.0 }),
                                "zIndex": max_z + 1 + i as i64,
                                "rotation": 0,
                                "tags": spec.get("tags").cloned().unwrap_or(Value::Array(vec![])),
                                "rating": spec.get("rating").and_then(|v| v.as_u64()).unwrap_or(0),
                            });
                            added_ids.push(id);
                            new_items.push(new_item);
                        }

                        // Append new items
                        let items_arr = board.get_mut("items").unwrap().as_array_mut().unwrap();
                        items_arr.extend(new_items);
                        let total_items = items_arr.len();

                        // Release items_arr borrow before mutating board
                        let _ = items_arr;
                        board["modifiedAt"] = Value::String(chrono_now());
                        match write_project(&path, &project) {
                            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
                            Ok(()) => {
                                // Notify running app to reload
                                let _ = state.app_handle.emit("mcp:project-changed", &path);
                                (StatusCode::OK, Json(serde_json::json!({
                                    "success": true,
                                    "addedCount": added_ids.len(),
                                    "addedIds": added_ids,
                                    "boardItemCount": total_items
                                })))
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn handle_move_items(
    State(state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let board_id = req.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let changes = req.get("changes").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    match resolve_project_path(project_path) {
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(mut project) => {
                match find_board_mut(&mut project, board_id) {
                    Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        let items = board.get_mut("items").and_then(|v| v.as_array_mut());
                        let items = match items {
                            Some(arr) => arr,
                            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": "Board has no items" }))),
                        };

                        let mut moved_ids = vec![];
                        for change in &changes {
                            let item_id = change.get("itemId").and_then(|v| v.as_str()).unwrap_or("");
                            if let Some(item) = items.iter_mut().find(|it| it.get("id").and_then(|v| v.as_str()) == Some(item_id)) {
                                if let Some(x) = change.get("x") { item["x"] = x.clone(); }
                                if let Some(y) = change.get("y") { item["y"] = y.clone(); }
                                if let Some(w) = change.get("width") { item["width"] = w.clone(); }
                                if let Some(h) = change.get("height") { item["height"] = h.clone(); }
                                if let Some(r) = change.get("rotation") { item["rotation"] = r.clone(); }
                                moved_ids.push(item_id.to_string());
                            }
                        }

                        board["modifiedAt"] = Value::String(chrono_now());

                        match write_project(&path, &project) {
                            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
                            Ok(()) => {
                                let _ = state.app_handle.emit("mcp:project-changed", &path);
                                (StatusCode::OK, Json(serde_json::json!({
                                    "success": true,
                                    "movedCount": moved_ids.len(),
                                    "movedIds": moved_ids
                                })))
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn handle_tag_items(
    State(state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let board_id = req.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let operations = req.get("operations").and_then(|v| v.as_array()).cloned().unwrap_or_default();

    match resolve_project_path(project_path) {
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(mut project) => {
                match find_board_mut(&mut project, board_id) {
                    Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        let items = board.get_mut("items").and_then(|v| v.as_array_mut());
                        let items = match items {
                            Some(arr) => arr,
                            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": "Board has no items" }))),
                        };

                        let mut modified_ids = vec![];
                        for op in &operations {
                            let item_id = op.get("itemId").and_then(|v| v.as_str()).unwrap_or("");
                            if let Some(item) = items.iter_mut().find(|it| it.get("id").and_then(|v| v.as_str()) == Some(item_id)) {
                                let mut modified = false;
                                // Add tags
                                if let Some(add_tags) = op.get("addTags").and_then(|v| v.as_array()) {
                                    let mut tags: Vec<String> = item.get("tags")
                                        .and_then(|v| v.as_array())
                                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                                        .unwrap_or_default();
                                    for t in add_tags {
                                        if let Some(tag) = t.as_str() {
                                            if !tags.iter().any(|existing| existing == tag) {
                                                tags.push(tag.to_string());
                                                modified = true;
                                            }
                                        }
                                    }
                                    item["tags"] = serde_json::json!(tags);
                                }
                                // Remove tags
                                if let Some(remove_tags) = op.get("removeTags").and_then(|v| v.as_array()) {
                                    let mut tags: Vec<String> = item.get("tags")
                                        .and_then(|v| v.as_array())
                                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                                        .unwrap_or_default();
                                    let remove: Vec<String> = remove_tags.iter().filter_map(|v| v.as_str().map(String::from)).collect();
                                    let before = tags.len();
                                    tags.retain(|t| !remove.contains(t));
                                    if tags.len() != before { modified = true; }
                                    item["tags"] = serde_json::json!(tags);
                                }
                                // Set rating
                                if let Some(rating) = op.get("rating").and_then(|v| v.as_u64()) {
                                    item["rating"] = Value::Number(rating.into());
                                    modified = true;
                                }
                                if modified {
                                    modified_ids.push(item_id.to_string());
                                }
                            }
                        }

                        board["modifiedAt"] = Value::String(chrono_now());

                        match write_project(&path, &project) {
                            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
                            Ok(()) => {
                                let _ = state.app_handle.emit("mcp:project-changed", &path);
                                (StatusCode::OK, Json(serde_json::json!({
                                    "success": true,
                                    "modifiedCount": modified_ids.len(),
                                    "modifiedIds": modified_ids
                                })))
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn handle_delete_items(
    State(state): State<Arc<McpHttpState>>,
    Json(req): Json<Value>,
) -> impl IntoResponse {
    let project_path = req.get("projectPath").and_then(|v| v.as_str());
    let board_id = req.get("boardId").and_then(|v| v.as_str()).unwrap_or("");
    let item_ids: Vec<String> = req.get("itemIds")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    match resolve_project_path(project_path) {
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "error": e }))),
        Ok(path) => match read_project(&path) {
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
            Ok(mut project) => {
                match find_board_mut(&mut project, board_id) {
                    Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": e }))),
                    Ok(board) => {
                        let items = board.get_mut("items").and_then(|v| v.as_array_mut());
                        let items = match items {
                            Some(arr) => arr,
                            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "error": "Board has no items" }))),
                        };

                        let mut deleted_ids = vec![];
                        items.retain(|item| {
                            let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            if item_ids.contains(&id.to_string()) {
                                deleted_ids.push(id.to_string());
                                false
                            } else {
                                true
                            }
                        });

                        let not_found: Vec<String> = item_ids.iter()
                            .filter(|id| !deleted_ids.contains(id))
                            .cloned()
                            .collect();

                        board["modifiedAt"] = Value::String(chrono_now());

                        match write_project(&path, &project) {
                            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "error": e }))),
                            Ok(()) => {
                                let _ = state.app_handle.emit("mcp:project-changed", &path);
                                let mut result = serde_json::json!({
                                    "success": true,
                                    "deletedCount": deleted_ids.len(),
                                    "deletedIds": deleted_ids
                                });
                                if !not_found.is_empty() {
                                    result["notFoundIds"] = serde_json::json!(not_found);
                                }
                                (StatusCode::OK, Json(result))
                            }
                        }
                    }
                }
            }
        }
    }
}

fn chrono_now() -> String {
    // Simple ISO-ish timestamp without chrono dependency
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // Return epoch millis as string — the frontend will handle formatting
    format!("{}", now.as_millis())
}

// --- Router builder ---

pub fn create_router(state: McpHttpState) -> Router {
    let shared = Arc::new(state);
    Router::new()
        .route("/health", get(handle_health))
        .route("/mcp/list_boards", post(handle_list_boards))
        .route("/mcp/get_board", post(handle_get_board))
        .route("/mcp/get_active_board", post(handle_get_active_board))
        .route("/mcp/get_selection", post(handle_get_selection))
        .route("/mcp/search_items", post(handle_search_items))
        .route("/mcp/add_items", post(handle_add_items))
        .route("/mcp/move_items", post(handle_move_items))
        .route("/mcp/tag_items", post(handle_tag_items))
        .route("/mcp/delete_items", post(handle_delete_items))
        .with_state(shared)
}

pub async fn start_mcp_http_server(state: McpHttpState) {
    let router = create_router(state);
    let addr = format!("127.0.0.1:{}", MCP_HTTP_PORT);
    eprintln!("[AgentRef] MCP HTTP API listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, router).await.unwrap();
}
