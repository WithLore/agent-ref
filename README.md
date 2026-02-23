# AgentRef

A PureRef-like infinite canvas reference board — built as a desktop app with AI agent integration.

Drop images, videos, YouTube links, and text notes onto an infinite canvas. Organize with groups and multiple boards. Save portable packages to share with colleagues. Expose your boards to AI agents via the built-in MCP server.

## Features

### Canvas
- Infinite pan/zoom canvas (0.02x to 10x) with dot grid
- Zoom-to-cursor for precise navigation
- Drag-and-drop files from your system
- Paste images, URLs, and text from clipboard
- Multi-select with Shift+click
- Always-on-top window mode

### Media Types
- **Images** — PNG, JPG, GIF, WebP, SVG, AVIF with lazy loading
- **Videos** — MP4, WebM, OGG with autoplay loop and loop region editor
- **YouTube** — Paste any YouTube URL, lazy-loads iframe on click
- **Text** — Double-click to edit inline notes

### Organization
- **Groups** — Select items and group them into labeled containers with colored borders
- **Multi-board** — Multiple boards per project, each with its own viewport
- **Tags & ratings** — Metadata fields for organizing references (UI in progress)

### Persistence
- **`.agentref`** — Lightweight JSON project files (references only)
- **`.agentref-pack`** — Portable ZIP packages with embedded media assets
- **Save/Load** — Native file dialogs (Tauri) or browser download/upload fallback

### MCP Server (AI Agent Integration)
- Built-in MCP server embedded directly in the app — no separate process needed
- Agents can query boards, groups, items, and **live selection state**, and can apply board edits
- HTTP API on `localhost:17532` when app is running + stdio MCP proxy via `--mcp` flag
- See [MCP Server Setup](#mcp-server) below

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open project |
| `Ctrl+Shift+E` | Export package (.agentref-pack) |
| `Delete` / `Backspace` | Delete selected items |
| `Space` + drag | Pan canvas |
| `Scroll wheel` | Zoom |

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri desktop build)

### Install & Run

```sh
# Install dependencies
npm install

# Run in browser (dev mode)
npm run dev

# Run as desktop app (Tauri)
npm run tauri:dev
```

### Build

```sh
# Browser build
npm run build

# Desktop app
npm run tauri:build
```

#### Build Output by Platform

| Platform | Output |
|----------|--------|
| **Windows** | `app.exe`, `.msi` installer, NSIS `.exe` installer |
| **macOS** | `.app` bundle, `.dmg` installer |
| **Linux** | `.deb`, `.AppImage` |

Build artifacts are in `src-tauri/target/release/` (binary) and `src-tauri/target/release/bundle/` (installers).

#### CI/CD Builds

Push a version tag to build for all platforms automatically via GitHub Actions:

```sh
git tag v0.1.0
git push origin v0.1.0
```

This triggers builds for Windows (x64), macOS (Intel + Apple Silicon), and Linux (x64), creating a draft GitHub Release with all installers attached.

## MCP Server

AgentRef includes an MCP (Model Context Protocol) server that lets AI agents query and update your reference boards. This enables workflows where an agent understands your curated visual context — which references you've collected, how you've grouped them, and what you currently have selected.

### What Agents Can Do

| Tool | Description |
|------|-------------|
| `list_boards` | List all boards with item/group counts and type breakdown |
| `get_board` | Get full board detail — items with resolved group labels, groups with member counts |
| `get_selection` | Get currently selected items (live state — requires app running) |
| `get_active_board` | Get the board you're working on (live state) |
| `search_items` | Search by tag, rating, type, group label, or free-text query |
| `add_items` | Add one or more items to a board |
| `move_items` | Move existing items by delta |
| `tag_items` | Add or remove tags on items |
| `delete_items` | Delete items by ID |

### How It Works

```
AgentRef (Tauri app)
├─ GUI window (SvelteKit frontend)
├─ HTTP API server (localhost:17532)     ◄── reads/writes .agentref files
│   └─ Emits Tauri events to frontend       on agent writes
│
└─ app.exe --mcp                         ◄── stdio MCP proxy
    └─ Forwards JSON-RPC → HTTP API
```

The MCP server is **embedded directly in the Tauri app**. When AgentRef launches, it starts an HTTP API on `localhost:17532`. The same `app.exe` binary with the `--mcp` flag runs a headless stdio proxy that translates MCP JSON-RPC messages into HTTP calls to the running app.

When an agent modifies your project (add items, move items, etc.), the app automatically reloads the changes in real-time — no manual refresh needed.

### Setup

**Prerequisites:** AgentRef must be running (the GUI app) so the HTTP API is available on port 17532.

Add to your MCP settings (`.claude/settings.json`, project settings, or `claude_desktop_config.json`):

**Windows:**
```json
{
  "mcpServers": {
    "agentref": {
      "command": "C:/path/to/agent-ref/src-tauri/target/release/app.exe",
      "args": ["--mcp"]
    }
  }
}
```

**macOS:**
```json
{
  "mcpServers": {
    "agentref": {
      "command": "/path/to/agent-ref/src-tauri/target/release/app",
      "args": ["--mcp"]
    }
  }
}
```

**Linux:**
```json
{
  "mcpServers": {
    "agentref": {
      "command": "/path/to/agent-ref/src-tauri/target/release/app",
      "args": ["--mcp"]
    }
  }
}
```

> **Note:** Replace the path with the actual location of your built binary. After `npm run tauri:build`, look in `src-tauri/target/release/`.

### Example Usage

Once registered, agents can query your boards:

> "What references do I have on my Characters board?"
>
> Agent calls `list_boards` → finds "Characters" board → calls `get_board` with that ID → returns all items grouped by character name

> "What am I currently looking at?"
>
> Agent calls `get_selection` → returns the 3 images you have selected, including their group ("The Clockmaker"), tags, and file paths

> "Add a text note to my board"
>
> Agent calls `add_items` → adds a text note item → app instantly shows it on canvas

### Live State

When AgentRef is running, it writes `~/.agentref/live-state.json` every time your selection or active board changes (debounced 200ms). The HTTP API reads this file for `get_selection` and `get_active_board` tools.

If the app isn't running, the `--mcp` proxy will fail to connect to the HTTP API and return appropriate errors.

## Project Structure

```
agent-ref/
  src/                          # SvelteKit frontend
    lib/
      board/                    # State management (project store, board actions, groups)
      canvas/                   # Canvas component, viewport, selection, coordinates
      items/                    # Item components (Image, Video, YouTube, Text) + types
      persistence/              # Save/load, serialization, ZIP packaging
      ui/                       # Sidebar, context menu, icons
      tauri-bridge.ts           # Tauri API integration with browser fallback
    routes/
      +page.svelte              # Main application page
    app.css                     # Global theme (monochrome black & white)
  src-tauri/                    # Tauri v2 desktop wrapper (Rust)
    src/
      main.rs                   # Entry point — GUI or --mcp stdio proxy
      lib.rs                    # Tauri app setup + HTTP server startup
      mcp_http.rs               # Embedded HTTP API server (port 17532)
      mcp_stdio.rs              # Stdio JSON-RPC MCP proxy
```

## Tech Stack

- **Frontend:** SvelteKit 2 + Svelte 5 (runes) + TypeScript
- **Desktop:** Tauri v2 (Rust) — Windows, macOS, Linux
- **MCP Server:** Embedded Rust (Axum HTTP API + stdio JSON-RPC proxy)
- **Packaging:** JSZip for portable .agentref-pack format
- **Testing:** Vitest (89 unit tests)
- **CI/CD:** GitHub Actions (cross-platform builds on tag push)
- **Theme:** Monochrome black & white, CSS custom properties

## License

Private — not yet licensed for distribution.

