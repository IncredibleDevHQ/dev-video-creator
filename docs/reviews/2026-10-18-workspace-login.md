# Workspace and local sign-in — 18 October 2026

Implemented on `codex/projects-research`, in the parallel preview at
http://127.0.0.1:4291 (engine 4391). The stack on 4187 was not used.

## Result

A persistent workspace rail owns Home, Projects, Search, Recent, and Sign out.
Projects open in one main surface; their sidebar owns Notes, Chat, and Create.
The project picker resumes the last resource and supports pinned projects.
Workspace search finds notebook text, chat titles, and research questions.
Recent links retain notebook/chat/question context through production views.
The original Incredible logo is retained.

The welcome screen has one explicit **Continue locally** action in the default
local mode. No database seed, default password, hosted account, or email service
is needed. Optional password mode uses server-configured owner credentials.
The API boundary protects data, assets, and voice upgrades; authentication is
resolved before workspace data loads. Server-side sessions have opaque tokens,
HttpOnly/SameSite=Lax cookies, expiry, failed-login throttling, rotation, and
logout revocation. Active streams and voice sockets also close on revocation.
SameSite=Lax permits top-level OAuth callbacks; existing host/origin and JSON
mutation guards remain in place. MCP retains its existing per-run token gate.

When a session ends, the UI closes any navigator dialog and presents sign-in
over the still-mounted workspace. It preserves drafts and never automatically
retries a rejected mutation.

## Macro reference and boundaries

Reviewed the local Macro repository's `docs/AGENT_GUIDE/navigation.md`,
`docs/AGENT_GUIDE/login.md`, `apps/web/src/components/view-shell/README.md`,
`apps/web/src/components/app/sidebar-next/sidebar-rail.tsx`, and split-layout
architecture. Borrowed the persistent global rail, resource-oriented navigation,
separate session/bootstrap boundary, and explicit local-development entry.
Macro's local passwordless email-code path informed the credential-free choice.
This implementation does not copy its hosted authentication infrastructure.

This is one local owner's workspace, not multiple tenant workspaces or team
accounts. Password mode is optional; local mode intentionally trusts loopback
CLI access even after browser sign-out. Sessions are in memory and end on engine
restart. Pins/recent links live in browser storage; note bodies are not persisted
in workspace history. The development servers remain loopback-only. Hosted SSO,
invitations, account recovery, and distributed session storage are outside this
change. Configuration is documented in `studio/README.md` and `.env.example`.

## Visible browser checks

- Credential-free entry, sign-out, and re-entry at 4291.
- Session restoration after reload.
- Project pinning and switching via the global picker.
- Cross-project search opens Connected learning in Dependable systems.
- A typed, unsaved note survived switching to another project and returning via
  Recent. The QA draft was then cleared without submitting it.
- Notes → existing Kimi-generated wireframes → Recent → Notes retained context.
- A separate disposable 4292/4392 stack exercised password mode: incorrect
  credentials displayed an inline error, correct credentials opened the app,
  reload restored the session, and sign-out returned to the welcome screen.
- Restarting that temporary engine invalidated the session. Opening Projects
  triggered sign-in over the open workspace; the unsaved draft survived renewal.
- Phone-width login and project picker checked at 390×844; no horizontal overflow.
  Mobile Sign out remains reachable. Temporary viewport and servers were removed.
- Final primary preview console inspection returned no errors.

No new AI generation was needed for these navigation/authentication changes.
Existing Kimi K3 research and wireframes were used as real content fixtures.

## Checks

- Full suite: 235 test files, 1,546 tests passed.
- Subsequent targeted authentication, HTTP, workspace-state, and server regression
  checks: 4 files, 25 tests passed, including newly added stream revocation,
  voice upgrade, and reauthentication checks.
- TypeScript and production build passed. Existing large-bundle warning remains.
- Source-size limits and `git diff --check` passed.

See [annotated screenshot proof](projects-research-evidence/workspace-login-annotated.html).
Raw captures are adjacent `workspace-*.jpg` files.
