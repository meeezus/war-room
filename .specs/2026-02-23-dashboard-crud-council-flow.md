# War Room Enhancement — Dashboard CRUD + Council Flow

Status: APPROVED — Implementing

## Sprint 1: Dashboard CRUD + Cleanup (5 tasks)

### S1-T1: Project PATCH/DELETE API ✅ 
- Create `app/api/projects/[id]/route.ts`
- PATCH + DELETE handlers via service client

### S1-T2: Project Card Inline Actions
- Three-dot dropdown on ProjectCard (rename/status/delete)
- stopPropagation on Link wrapper
- onUpdate callback to parent

### S1-T3: Smart Priority + Target Dates + SOW Linkage
- computeSmartPriority() heuristic
- target_date + council_session_id columns (migration)
- project_id on council_sessions (migration)
- Target date display on card

### S1-T4: Event Feed — Attention Zones + Filter
- Filter dropdown, Clear button
- Hide heartbeats by default
- Group into Needs You / Active / Complete zones

### S1-T5: Role Cards + Legacy Names
- Remove `power` entry, add LEGACY_NAME_MAP
- Update getRoleCard() to check legacy map
- Remove Lv. badge from sidebar

### S1-T6: Auto-Title Threads + Inline Rename
- Auto-title from first user message after assistant responds
- Double-click to rename in ThreadList sidebar

## Sprint 2: Council Flow Enhancement (5 tasks)

### S2-T1: HTML Plan Generation in Council API
- Second Claude call for plan_html (Promise.allSettled)
- House palette, dark theme

### S2-T2: Navigation After Create
- council-actions: useRouter → navigate after create
- chat-actions: open council in new tab
- Pass council_session_id

### S2-T3: Accept/Reject/Iterate UX
- Action buttons on council-synthesis
- Accept → CreateProjectModal, Reject → archive, Iterate → scroll to terminal

### S2-T4: Interactive Terminal Panel
- POST /api/council/[id]/input endpoint
- Wire inputUrl to InlineTerminal

### S2-T5: Project + Mission Detail Page Enhancement
- Add terminal panels to existing detail pages
- Create input endpoints for both
