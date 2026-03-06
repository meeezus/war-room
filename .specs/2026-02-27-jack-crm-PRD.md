# Health Optimization CRM — Product Requirements Document

**Product:** Skool CRM (Product #3 in the Jack Schroder Bundle)
**Date:** 2026-02-27
**Phase:** PRD (What)
**Council:** Bulma (Product), Light (Strategy), Loid (Sales), Makima (Synthesis)
**Status:** Draft

---

## Overview

A private community management tool that gives Jack Schroder instant context on every member of his 267-person Health Optimization Skool community ($149/mo). The CRM scrapes member data daily, surfaces at-risk members, tracks engagement, and drafts contextual replies — so Jack can respond in 30 seconds instead of 5 minutes re-reading history.

Part of the $1,200/mo founding partner bundle alongside Research Assistant and Community Agent. Standalone CRM pricing TBD — time saved analysis shows $1,250-$5,000/mo in recovered time value, suggesting $400-500/mo standalone pricing.

---

## User Personas

### Primary: Jack Schroder (Community Owner)
- **Who:** Health optimization practitioner, runs a 267-member Skool community at $149/mo
- **Goal:** Manage community engagement without it eating his entire day. Know every member's context instantly.
- **Pain:** Can't remember what he recommended to each member. Manually scrolls through threads to recall lab results, protocols, and history. At 267 members, some fall through the cracks.
- **Success:** Opens CRM, sees who needs attention, drafts a reply in 30 seconds, copies to Skool. Weekly: sees retention improving over time.

### Secondary: Jack's Virtual Assistant (Phoebe)
- **Who:** VA who helps Jack with community management
- **Goal:** Triage and draft responses on Jack's behalf, manage outreach to at-risk members
- **Pain:** Currently does churn checks manually. No centralized view of member status.
- **Success:** Opens CRM with VA access, handles routine outreach, flags complex cases for Jack.

### Anti-Persona: Skool Members
- This tool is NOT for community members. They never see it. Jack's replies in Skool look exactly the same — he just writes them faster with better context.

---

## Job-to-be-Done

**Jack:** When a member posts in my community, I want to instantly recall their full health history, labs, protocols, and my past recommendations, so I can give a personalized, informed reply without re-reading months of threads.

**Jack (retention):** When members go quiet or show signs of disengagement, I want to be proactively alerted with a draft check-in message, so I can intervene before they churn.

**Phoebe (VA):** When I'm helping Jack manage his community, I want a clear view of who needs attention and pre-drafted responses, so I can handle routine outreach without bothering Jack.

---

## User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|------------|----------|
| US-001 | Jack | See at-a-glance dashboard of community health | I know what needs my attention in <10 seconds | Must |
| US-002 | Jack | View at-risk members (gone quiet, never engaged) | I can intervene before they churn | Must |
| US-003 | Jack | See threads awaiting my reply | I don't miss anyone | Must |
| US-004 | Jack | Open any member's full context card (history, labs, protocols, my recommendations) | I can reply with full context | Must |
| US-005 | Jack | Get an AI-drafted reply based on member's context | I can reply in 30 seconds instead of 5 minutes | Must |
| US-006 | Jack | Copy draft to clipboard and jump to Skool | Workflow is seamless | Must |
| US-007 | Jack | Filter members by status (active, at-risk, awaiting reply, new) | I can focus on specific groups | Must |
| US-008 | Jack | Sort member table by any column | I can find who I need quickly | Must |
| US-009 | Jack | See response rate and average response time | I can track my own engagement quality | Should |
| US-010 | Jack | Filter dashboard by time period (7d, 30d, 3m, all) | I can see trends and compare periods | Should |
| US-011 | Jack | See +/- deltas on all key metrics | I know if things are improving or declining | Should |
| US-012 | Jack | Ask the CRM chatbot about any member | I get instant answers in natural language | Should |
| US-013 | Jack | See recent activity feed with links to Skool | I can jump to any conversation | Should |
| US-014 | Jack | Export a member report | I have data for my records | Could |
| US-015 | Jack | Get email notifications for at-risk members | I'm alerted even when I'm not in the CRM | Could |
| US-016 | Jack | Grant VA access with scoped permissions | Phoebe can help without full access | Could |
| US-017 | Jack | See retention trends over time (graphs) | I can prove the CRM's value | Must |
| US-018 | Jack | See time saved calculator with methodology tooltips | I can quantify ROI and justify the tool's cost | Must |
| US-019 | Jack | View 5 trend charts (community, at-risk, response rate, response time, time saved) | I can track all key metrics over time | Must |
| US-020 | Jack | See Low/Medium/High time saved estimates with dollar values | I understand the range of value the CRM provides | Should |

---

## User Flows

### Happy Path: Daily Check-in (2 minutes)
```
1. Jack opens CRM (bookmarked URL or desktop shortcut)
2. Dashboard loads → sees 3 signal cards: Active Community (267, +3), At-Risk (2, +1), Awaiting Reply (2, 0)
3. Scans "Members Needing Attention" → Elena gone quiet, Jordan never engaged
4. Clicks "Draft Check-in" on Elena → AI-generated draft appears
5. Reviews draft, clicks "Copy to Clipboard"
6. Clicks "Open in Skool" → Skool opens to Elena's thread
7. Pastes reply, sends. Done in 30 seconds.
8. Scrolls to "Threads Needing Your Reply" → Tre has new labs
9. Clicks Tre → full context card opens (labs, protocols, last recommendation)
10. Clicks "Draft Reply" → personalized draft referencing Tre's specific labs
11. Copies, opens Skool, pastes. Done.
12. Glances at Recent Activity → everything looks normal
13. Closes CRM. Total time: ~2 minutes.
```

### Happy Path: Deep Dive on a Member
```
1. Jack wonders "What did I recommend for Tim?"
2. Opens CRM chatbot → types "What did I recommend for Tim?"
3. Bot returns Tim's full recommendation history with dates
4. Jack clicks "Draft Reply" directly from the bot response
5. Reviews draft, copies, sends in Skool
```

### Error Path: Scraper Fails
```
1. Daily scraper runs at 6 AM
2. Skool session has expired → scraper detects redirect
3. Scraper attempts automated re-login (password from Keychain)
4. If re-login succeeds → scrape proceeds normally
5. If re-login fails → Makima alerts Sensei on Discord with error details
6. CRM still works with last-scraped data (stale badge shows "Last sync: 2 days ago")
7. Sensei can click "Sync Now" in Settings to trigger manual re-scrape
```

### Error Path: Member Data is Stale
```
1. Jack opens CRM → sees "Last sync: 3 days ago" warning in header
2. Yellow banner: "Data may be out of date. Click to sync."
3. Jack clicks sync → scraper runs in background
4. Banner updates to "Syncing..." → "Last sync: just now"
```

---

## Feature Matrix

| Feature | MVP (v0.1) | V1.0 | V1.1 | Notes |
|---------|:----------:|:----:|:----:|-------|
| **Data Pipeline** | | | | |
| Playwright scraper with persistent profile | ✓ | | | Core data source |
| Automated re-login (password + code fallback) | ✓ | | | Reliability |
| Daily scheduled scrape (launchd) | ✓ | | | Automation |
| Failure alerting (Discord/Makima) | | ✓ | | Monitoring |
| **Dashboard** | | | | |
| Signal cards (Active, At-Risk, Awaiting Reply, Response Rate) | ✓ | | | At-a-glance |
| +/- deltas on cards | ✓ | | | Trend awareness |
| Time filter (7d, 30d, 3m, all) | ✓ | | | Period comparison |
| Members Needing Attention section | ✓ | | | Retention action |
| Threads Needing Reply section | ✓ | | | Engagement action |
| Recent Activity feed with links | ✓ | | | Context |
| Clickable signal cards (jump to filtered view) | ✓ | | | Navigation |
| **Member Management** | | | | |
| Filterable member table (All/Active/Awaiting/At-Risk/New) | ✓ | | | Core navigation |
| Sortable columns | ✓ | | | Usability |
| Search by name, protocol, keyword | ✓ | | | Findability |
| Member detail card (labs, protocols, recommendations, activity) | ✓ | | | Core value |
| Response rate + avg response time per member | ✓ | | | Engagement tracking |
| **Actions** | | | | |
| Draft Reply (AI-generated, context-aware) | ✓ | | | Key differentiator |
| Copy to Clipboard | ✓ | | | Workflow |
| Open in Skool (deep link) | ✓ | | | Workflow |
| Draft Check-in (for at-risk members) | ✓ | | | Retention |
| Draft Onboarding (for never-engaged members) | ✓ | | | Activation |
| **CRM Chatbot** | | | | |
| Natural language member lookup | ✓ | | | Convenience |
| Pre-scripted queries (pull up X, who's quiet, etc.) | ✓ | | | Discoverability |
| Inline draft reply from bot response | ✓ | | | Flow |
| **Settings & Reports** | | | | |
| Settings panel (notification toggles, VA access) | ✓ | | | Configuration |
| Time saved calculator with methodology tooltips | ✓ | | | ROI proof |
| 5 trend charts (community, at-risk, response rate, response time, time saved) | ✓ | | | Value proof |
| Report time filter (3m/6m/1y) | ✓ | | | Period comparison |
| Email notifications for at-risk members | | ✓ | | Proactive alerting |
| VA/team member access | | ✓ | | Delegation |
| Export Report (CSV) | | ✓ | | Data portability |
| Data sync status + manual trigger | ✓ | | | Transparency |

---

## Acceptance Criteria

### US-001: Dashboard At-a-Glance
- [ ] Page loads in <2 seconds
- [ ] 4 signal cards show: Active Community count, At-Risk count, Awaiting Reply count, Response Rate %
- [ ] Each card shows +/- delta relative to selected time period
- [ ] Clicking a card navigates to the relevant filtered view
- [ ] Data is no more than 24 hours stale (daily scrape)

### US-002: At-Risk Members
- [ ] "Members Needing Attention" shows members with status gone-quiet or never-engaged
- [ ] Each card shows: name, status badge, last active date, brief context, Draft Check-in button
- [ ] Section appears on Dashboard AND Member Management tab
- [ ] At-Risk count in signal card matches members shown

### US-004: Member Context Card
- [ ] Card opens as overlay (no page navigation)
- [ ] Shows: name, status, joined date, last active, engagement level
- [ ] Shows: summary, lab results (with actual values where available), active protocols, Jack's past recommendations
- [ ] Shows: response rate, avg response time, total comments, Jack's reply count
- [ ] Shows: recent activity at bottom (last 2-3 interactions)
- [ ] Jack's recommendations are clickable → opens in Skool

### US-005: Draft Reply
- [ ] Draft generates based on member's context (labs, protocols, history, last message)
- [ ] Draft opens in overlay with clear "AI-generated" label
- [ ] "Copy to Clipboard" works (copies plain text, no HTML)
- [ ] "Open in Skool" navigates to the member's thread
- [ ] "Back to Profile" returns to context card
- [ ] Draft works from: Dashboard thread cards, At-Risk section, Member detail card, Chatbot

### US-007: Filter Members
- [ ] Filter bar shows: All, Active, Awaiting Reply, At-Risk, New
- [ ] Each filter button shows count
- [ ] Filter + search work together (compound filtering)
- [ ] At-Risk section shows/hides based on active filter

### US-008: Sort Table
- [ ] All column headers are clickable for sorting
- [ ] Clicking toggles between ascending/descending
- [ ] Sort arrow indicator shows current sort direction
- [ ] Sort persists when changing filters

---

## Success Metrics

| Metric | Current (Manual) | Target (CRM) | How to Measure |
|--------|:----------------:|:-------------:|----------------|
| Time to reply to a member | ~5 min (re-reading history) | <1 min (with context card) | Self-reported by Jack |
| At-risk members caught | Unknown (reactive) | 100% flagged within 7 days | Scraper data vs. churn |
| Members who churned without intervention | Unknown | 0 | Monthly retention vs. at-risk alerts |
| Jack's daily community management time | ~45 min | ~15 min | Self-reported |
| Response rate | ~99% (already high) | Maintain 99%+ | Scraper data |
| Average response time | Unknown | Track and display | Scraper data |
| Phoebe's triage capability | Manual scrolling | Uses CRM dashboard | VA access logs |

---

## Out of Scope (This Version)

| Feature | Deferred To | Reason |
|---------|-------------|--------|
| Live AI / LLM integration for drafts | V1.1 | MVP uses pre-scripted templates. Real LLM integration after core data pipeline is proven |
| Real-time Skool webhook sync | V2 | Daily scrape is sufficient. Skool doesn't offer webhooks anyway |
| Mobile optimization | V1.1 | Desktop-first for demo and daily use |
| Authentication / user login | V1.0 | MVP is local HTML. Production version needs auth |
| Payment / billing integration | Never (for CRM) | Handled by Sensei's invoicing |
| Skool DM automation | V1.1 | Need to validate scraper reliability first |
| Lab value parsing (actual numbers) | V1.0 | Need to test what data we can actually extract from threads |
| Member profile scraping (individual pages) | V1.0 | MVP scrapes member list only. Deep scrape is follow-on |
| Multi-community support | V2 | Jack only has one community |

---

## Open Questions

- [ ] What data can we actually extract from the `/members` page? (DOM selectors unknown until first successful scrape)
- [ ] Can we scrape individual member profile pages for deeper data (join date, activity level)?
- [ ] How often do Skool sessions expire? (Need to observe in production)
- [ ] Does Jack want revenue stats in the CRM? (Removed for now — grandfathered pricing complicates it. Ask him.)
- [ ] What's the deeplink URL format for Skool threads? (Need to discover for "Open in Skool" to actually work)
- [ ] How does Jack want to receive at-risk alerts — email, Discord, or both?
- [ ] Should the CRM eventually be a hosted web app (Vercel) or stay as a local HTML file with a data refresh script?

---

## Data Sources

| Source | What It Provides | Status |
|--------|-----------------|--------|
| Skool `/members` page (scraper) | Member list: names, avatars, join dates, activity levels | Not yet scraped — DOM unknown |
| Parsed health journal threads | 4 threads: Tre, Matt, Sarah/Caitlin, Tim — 310 total comments | ✓ Available at `skool-data/parsed-threads.json` |
| Jack's blog index | 197+ blogs for content cross-referencing | Available at `~/Desktop/skool-blogs-backup/` |
| Manual enrichment | Lab values, protocol details, recommendations | Extracted from parsed threads |

---

## Transition to TRD

This PRD defines WHAT we're building. The TRD will specify HOW:
- Scraper architecture (Playwright persistent profile + re-login stack)
- Data model (member schema, engagement calculations, staleness tracking)
- Credential security (macOS Keychain, Gmail IMAP app password)
- Hosting strategy (local HTML → hosted web app migration path)
- Integration points (Shogunate engine, Makima alerting, Discord notifications)
