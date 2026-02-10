# PRD: Shogunate War Room v2

## Features to Build

### 1. Discord Routing (Pip vs Sage Separation)
- [ ] Create `/api/discord/route` endpoint
- [ ] Route DMs → Pip (general)
- [ ] Route #council-chat → Sage (product strategy)
- [ ] Route #agent-lab → Atlas (engineering)
- [ ] Config file: `config/discord-routes.json`

### 2. File System Sync (Watch ~/Shugyo/Shogunate/)
- [ ] File watcher using `chokidar` or `fs.watch`
- [ ] Sync on change: update War Room data
- [ ] Real-time UI updates via WebSocket/SSE
- [ ] Watch paths: `~/Shugyo/Shogunate/**/*.md`

### 3. Obsidian Deep Links
- [ ] Transform `[[Note Name]]` → `obsidian://open?vault=Shugyo&file=Note%20Name`
- [ ] Component: `<ObsidianLink note="Note Name" />`
- [ ] Works in Kanban cards, Event feed, Daimyo status

### 4. Sub-boards for Daimyo Epics
- [ ] Route `/daimyo/[name]` → individual epic board
- [ ] Each Daimyo gets: Tasks, Events, Notes, Metrics
- [ ] Atlas: Engineering board with Folio sprints
- [ ] Sage: Product board with roadmap
- [ ] Vex: Commerce board with deals
- [ ] Spark: Content board with campaigns
- [ ] Bolt: Ops board with automation

## Acceptance Criteria
- [ ] Discord messages route to correct agent automatically
- [ ] File changes in Shuguto/ appear in War Room within 5 seconds
- [ ] All [[Note]] references are clickable Obsidian links
- [ ] Each Daimyo has a working sub-board at /daimyo/[name]
- [ ] All features work in production (Vercel)

## Done When
- [ ] PRD checklist complete
- [ ] Deployed to war-room-liart.vercel.app
- [ ] Tested: file sync, Discord routing, Obsidian links
