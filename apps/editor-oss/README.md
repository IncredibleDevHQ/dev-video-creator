# Editor OSS (Go Prototype)

This workspace hosts the fresh, editor-first rewrite that powers the OSS migration. The focus is a minimal stack that lets anyone open the editor, storyboard content, and preview layout changes without any proprietary dependencies.

## Guiding Principles

- **Editor-first**: The markdown/Tiptap editor and storyboard preview are the first-class features. Auth, media encoding, and collaboration come later.
- **Small surface area**: Start with a tiny REST API (`/api/stories`) that the client can expand gradually.
- **No hidden services**: Only use components that a hobby project can host locally (Go, SQLite, Vite, Tiptap, FFmpeg, etc.).

## Current Layout

```
apps/editor-oss/
├── cmd/server/          # go run ./cmd/server boots the API
├── internal/
│   ├── api/             # HTTP handlers and routing
│   ├── models/          # Shared domain structs (Story, Fragment, Revision)
│   ├── storage/         # Memory & SQLite persistence
│   ├── intents/         # LLM service for intent suggestions
│   ├── diff/            # Unified diff generation
│   └── config/          # Configuration loading
├── web/                 # Embedded vanilla JS frontend
│   └── static/          # HTML, CSS, JS files
├── README.md            # You are here
├── go.mod               # Go module declaration
└── .env.example         # Environment variable examples
```

## Features & Roadmap

### ✅ Completed
- **Story & Fragment API** – Full CRUD REST API for stories and fragments
- **Revision History** – Captures before/after snapshots with unified diffs
- **AI Intent Suggestions** – GPT-powered explanations of editing patterns
- **Tag Categorization** – Auto-tags edits: clarity, brevity, structure, tone, examples, context, formatting, correction
- **SQLite Persistence** – Optional persistent storage (configure with `EDITOR_DB_PATH`)
- **Web Editor** – Vanilla JS markdown editor with live preview and drag-and-drop fragments
- **Pluggable LLM** – Supports OpenAI, custom HTTP endpoints, or manual intent entry

### 🚧 Next Steps
1. **Persona Building** – Aggregate similar intents to extract reusable editing patterns
2. **"Apply My Style" Feature** – Use captured persona to guide edits on new drafts
3. **Intent Search** – Filter revisions by tag (e.g., "show all clarity edits")
4. **Realtime Collaboration** – Yjs WebRTC or Hocuspocus for presence
5. **Media Preview** – FFmpeg-based preview exporter for code/markdown blocks

## Getting Started

### Quick Start (In-Memory Mode)

```bash
cd apps/editor-oss
go run ./cmd/server
```

Open `http://localhost:8081/` to use the embedded web editor. Data is stored in-memory and resets on restart.

### Persistent Storage (SQLite)

```bash
export EDITOR_DB_PATH=./editor.db
go run ./cmd/server
```

Data persists across restarts. The database is created automatically with seeded demo content.

### Environment Variables

Copy `.env.example` to `.env` and configure:

**Storage:**
- `EDITOR_API_PORT` – Server port (default: 8081)
- `EDITOR_DB_PATH` – SQLite file path (default: in-memory storage)

**Intent Service (optional):**
- `OPENAI_API_KEY` – OpenAI API key for intent suggestions
- `OPENAI_MODEL` – Model to use (default: gpt-4o-mini)
- `OPENAI_ORG` – OpenAI organization ID

Or use a custom LLM endpoint:
- `AICHAT_BASE_URL` – Custom LLM base URL
- `AICHAT_MODEL` – Model name

If no LLM is configured, intent descriptions must be entered manually.

### Run everything with Docker Compose

```bash
# from repo root
export OPENAI_API_KEY=sk-your-key
docker compose up --build editor
```

- The editor service listens on `http://localhost:8081`.
- All intent calls go directly to OpenAI via the key you provided; tweak `OPENAI_MODEL` in `.env` or the environment if you want a different target.

### REST Endpoints

- `GET /api/health` – quick status check.
- `GET /api/stories` – list seeded demo storyboards.
- `POST /api/stories` – create a new story (send JSON payload).
- `GET /api/stories/{id}` – fetch a single story with fragments.
- `PUT /api/stories/{id}` – replace a story + fragments.
- `DELETE /api/stories/{id}` – remove a story.
- `GET /api/stories/{id}/fragments` – list fragments in order.
- `POST /api/stories/{id}/fragments` – append a new fragment.
- `GET /api/stories/{id}/fragments/{fragmentId}` – fetch a fragment.
- `PATCH /api/stories/{id}/fragments/{fragmentId}` – update metadata/content.
- `DELETE /api/stories/{id}/fragments/{fragmentId}` – remove a fragment.
- `GET /api/stories/{id}/fragments/{fragmentId}/revisions` – list saved revisions + intents.
- `POST /api/stories/{id}/fragments/{fragmentId}/revisions` – persist a revision with final intent (also refreshes fragment content).
- `POST /api/stories/{id}/fragments/{fragmentId}/revisions/preview` – request an LLM intent suggestion (requires `OPENAI_API_KEY`).

## How It Works

### Editing Intent Capture

The core innovation is capturing **why** you edited, not just what changed:

1. **Edit markdown** in the left pane, see live preview on the right
2. Click **"Done Editing"** to save changes
3. The system:
   - Generates a unified diff (before → after)
   - Calls LLM to suggest editing intent with tags
   - Shows modal with suggested intent (you can edit it)
   - Saves revision: `{ before, after, diff, intent: { summary, tags, source } }`
4. **View revision history** in the sidebar to see all past edits and their intents

### Intent Tags

The LLM automatically categorizes edits with these tags:
- **clarity** – Made content easier to understand
- **brevity** – Reduced wordiness or length
- **structure** – Reorganized flow or hierarchy
- **tone** – Adjusted voice/formality
- **examples** – Added/improved code samples
- **context** – Added background or explanatory detail
- **formatting** – Changed layout, headings, or emphasis
- **correction** – Fixed errors or inaccuracies

These tags help identify patterns in your editing style over time.

Keep this README up to date as the prototype grows.
