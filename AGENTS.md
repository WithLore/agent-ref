# AgentRef Codex Context

## Product intent

AgentRef is a local-first desktop reference canvas for collecting images, video, YouTube links, and text notes in an agent-readable workspace. Keep capture fast, visual organization flexible, and the desktop experience unobtrusive.

The longer-term product direction is low-friction context dumping for human and agent collaboration. Treat notes, task capture, voice/hotkey ideas, and external memory enrichment as future directions unless the current code and a working integration prove they exist.

## Current architecture

- `src/` contains the SvelteKit 2 / Svelte 5 interface.
- `src-tauri/` contains the Tauri 2 macOS/Windows/Linux shell and Rust MCP bridge.
- The running GUI exposes a local HTTP API at `127.0.0.1:17532`.
- The compiled binary with `--mcp` is a stdio MCP proxy for Codex and other agents.
- Live MCP tools require the AgentRef GUI to be running. Do not describe the integration as connected until the health endpoint and an MCP handshake have both been verified.

## Working agreements

- Make changes on a dedicated branch; do not work directly on `main`.
- Preserve existing user changes and `.agentref` project files.
- Use `npm ci` for a clean dependency install.
- Use `npm run tauri:dev` for the native development app and `npm run dev` only for browser-only UI work.
- Before handing off code changes, run `npm run test`, `npm run check`, and `npm run build`.
- After Rust, Tauri, persistence, or MCP changes, also build the native app and verify `GET http://127.0.0.1:17532/health`, the MCP `initialize` response, and `tools/list`.
- After a verified native build, update the installed copy with `ditto src-tauri/target/release/bundle/macos/AgentRef.app /Users/nicholas/Applications/AgentRef.app` before testing the installed app. Ask before overwriting an installed copy that contains unverified user changes.
- Treat a successful compile as technical verification, not visual acceptance. Inspect the actual desktop window for meaningful UI changes.

## MCP safety

- Prefer read-only board tools when understanding context.
- Confirm the target board and item IDs before write operations.
- Do not delete board items or overwrite project files without explicit user intent.
- Keep the MCP server bound to localhost unless the user explicitly requests and approves a reviewed remote-access design.

## This Mac

- Editable checkout: `/Users/nicholas/Documents/agent-ref`
- Installed app: `/Users/nicholas/Applications/AgentRef.app`
- Codex MCP server name: `agentref`

These paths are local setup facts. Do not bake them into portable product code.
