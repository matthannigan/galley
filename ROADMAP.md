# Galley Roadmap

## What's Been Built

Galley has reached a stable baseline for its core use case: a two-person workflow where one person owns document structure and another edits content visually.

| Release | Theme |
|---------|-------|
| **0.1** | MVP — inline editing of served HTML files, save with backups, Docker support |
| **0.2** | Editing depth — file management, undo, save conflicts, auto-reload, formatting toolbar, block operations |
| **0.3** | Onboarding — landing page redesign, editor help panel, interactive sample document as user guide |
| **0.4** | Infrastructure — static asset serving, config file, security audit and hardening, PUID/PGID Docker support |

See [CHANGELOG.md](CHANGELOG.md) for release details.

## What's Next

No specific phase is currently planned. The tool covers its intended workflow well, and the next direction depends on what friction surfaces in real use.

Areas worth watching:

- **Editing comfort** — Are there formatting or structural operations Cathy reaches for that aren't supported? Does the block operations model cover enough of the content patterns in practice?
- **Asset workflow** — Static asset serving shipped, but images still need to be placed on disk manually. Is that a bottleneck, or is it fine for the current volume?
- **Multi-document workflow** — As the document collection grows, does the landing page card grid scale well enough? Is search or filtering needed?

## Future Considerations

These are not currently planned but are worth keeping in mind architecturally. Each would represent a significant increase in scope and complexity.

### Real-Time Collaborative Editing

WebSocket-based sync using operational transforms or CRDTs for simultaneous editing with live cursors. This is a fundamental architectural change — the server becomes stateful, conflicts are resolved algorithmically rather than by last-write-wins, and the client must handle remote operations applied to the DOM mid-edit.

Not recommended until the polling-based workflow (auto-reload + conflict detection) proves insufficient for the team's actual usage patterns.

### User Presence and Awareness

Display which users are currently viewing or editing a document. Requires session or connection tracking on the server. Natural companion to real-time sync but adds complexity on its own.

### Authentication

Username/password or shared passphrase for access control. Currently handled at the network layer (Cloudflare tunnel access policies). Only needed if Galley is exposed to a broader audience or if per-user edit attribution is desired.

### Change Attribution and History

Track which user made which edits, with a visual timeline or diff viewer. Requires authentication (to identify users) and either a richer backup format or a separate change log.
