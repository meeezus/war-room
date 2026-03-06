# Health Optimization CRM — Technical Requirements Document

**Product:** Skool CRM (Product #3 in the Jack Schroder Bundle)
**Date:** 2026-02-27
**Phase:** TRD (How)
**Council:** Ed (Engineering), Bulma (Product), Major (Operations), L (Security), Toji (Audit)
**Status:** Draft
**PRD:** `.specs/2026-02-27-jack-crm-PRD.md`

---

## Experience Outcome

When Jack opens his CRM each morning, he sees which members need attention, gets instant context on anyone, and replies to his community in 15 minutes instead of 45 — because the scraper ran overnight and every member's labs, protocols, and history are one click away.

---

## Context

Jack manages a 267-member Skool community ($149/mo) where he gives personalized health advice. His replies reference specific lab markers, supplement protocols, and past recommendations — requiring him to re-read 1,295 words of thread history per reply (measured from real data). The CRM eliminates that re-reading with instant context cards and AI-drafted replies.

**Technical challenge:** Skool has no API. All member data must be scraped via Playwright. Sessions expire, DOM structure is unknown until first successful authenticated scrape, and login requires either password or email OTP code.

**Architecture evolution:**
- **MVP (v0.1):** Local HTML + JSON files + Playwright scraper + launchd
- **V1.0:** Vercel + Supabase + auth + LLM draft replies
- **V1.1:** Skool DM automation, mobile optimization

---

## System Architecture

### MVP Data Flow

```
┌──────────────────┐
│  Skool.com       │
│  /members page   │
└───────┬──────────┘
        │ Playwright (daily, launchd)
        ▼
┌──────────────────┐     ┌──────────────────────────┐
│ scrape-members.ts│────▶│ members-list.json         │
│ (persistent      │     │ ~/Shugyo/.../skool-data/  │
│  browser profile)│     └────────────┬─────────────┘
└──────────────────┘                  │
                                      │ <script> fetch() or inline
        ┌─────────────────────────────┘
        ▼
┌──────────────────────────────────────┐
│ crm-prototype.html                   │
│  - Dashboard (signal cards, deltas)  │
│  - Member Management (table, detail) │
│  - Reports (charts, time saved calc) │
│  - Chatbot (natural language lookup) │
│  - Settings (notifications, VA)      │
└──────────────────────────────────────┘

Side inputs:
  parsed-threads.json ──▶ Member context (labs, protocols, recommendations)
  Jack's manual notes  ──▶ Enrichment (future: Supabase)
```

### Authentication Hierarchy

```
1. Persistent browser profile (userDataDir)
   └─ Playwright reuses Chrome session cookies
   └─ Valid: 7-30 days (observed)
   └─ Fastest, zero-interaction

2. Password re-login (fallback #1)
   └─ Credentials from macOS Keychain
   └─ `security find-generic-password -s skool -a jack@email.com -w`
   └─ Automated, no human needed

3. OTP code via Gmail IMAP (fallback #2)
   └─ Skool "Log in with a code" → email → IMAP fetch
   └─ Gmail App Password from Keychain
   └─ 60-second window to fetch and enter code
   └─ Last resort before alerting human

4. Manual intervention (fallback #3)
   └─ Scraper opens visible browser, waits 5 min for human login
   └─ Alerts Makima on Discord with error details
```

---

## Functional Requirements

| ID | Requirement | Priority | Sprint |
|----|-------------|----------|--------|
| **Data Pipeline** | | | |
| FR-001 | The scraper SHALL authenticate to Skool using persistent browser profile, falling back to password, then OTP/IMAP | Must | S1 |
| FR-002 | The scraper SHALL extract all members from /members page via infinite scroll, capturing: name, profile URL, avatar URL, join date, last active, level, contributions, role | Must | S1 |
| FR-003 | The scraper SHALL output structured JSON to `skool-data/members-list.json` with scrape timestamp and member count | Must | S1 |
| FR-004 | The scraper SHALL detect expired sessions (redirect to /about or /login, "LOG IN" button visible) before attempting to scrape | Must | S1 |
| FR-005 | The scraper SHALL save debug artifacts (screenshot + HTML dump) on every run to `skool-data/debug/` | Must | S1 |
| FR-006 | The scraper SHALL run daily at 06:00 CT via macOS launchd agent | Must | S2 |
| FR-007 | The scraper SHALL alert Makima on Discord when all auth fallbacks fail | Should | S2 |
| FR-008 | The scraper SHALL save/refresh cookies after every successful scrape | Must | S1 |
| **Dashboard** | | | |
| FR-010 | The CRM SHALL display 4 signal cards: Active Community, At-Risk, Awaiting Reply, Response Rate with +/- deltas | Must | S1 |
| FR-011 | The CRM SHALL filter dashboard metrics by time period (7d, 30d, 3m, all) | Must | S1 |
| FR-012 | The CRM SHALL display "Members Needing Attention" with status badge, last active date, and Draft Check-in button | Must | S1 |
| FR-013 | The CRM SHALL display "Threads Needing Reply" with member name, thread excerpt, and Draft Reply button | Must | S1 |
| FR-014 | Signal cards SHALL be clickable, navigating to the relevant filtered member view | Must | S1 |
| **Member Management** | | | |
| FR-020 | The CRM SHALL display a filterable member table with columns: Name, Last Active, Response Rate, Avg Response Time, Engagement, Status, Joined | Must | S1 |
| FR-021 | Filter bar SHALL show: All, Active, Awaiting Reply, At-Risk, New — each with count badge | Must | S1 |
| FR-022 | All column headers SHALL be sortable (click toggles asc/desc) | Must | S1 |
| FR-023 | Search SHALL filter by name, protocol keyword, or lab marker | Must | S1 |
| FR-024 | Member detail card SHALL open as overlay showing: summary, lab results, active protocols, Jack's past recommendations, response stats, recent activity | Must | S1 |
| **Actions** | | | |
| FR-030 | Draft Reply SHALL generate a context-aware response referencing the member's labs, protocols, and history | Must | S1 |
| FR-031 | Copy to Clipboard SHALL copy plain text (no HTML markup) | Must | S1 |
| FR-032 | Open in Skool SHALL deep link to the member's thread on Skool | Must | S1 |
| FR-033 | Draft Check-in SHALL generate a personalized re-engagement message for at-risk members | Must | S1 |
| FR-034 | Draft Onboarding SHALL generate a welcome/activation message for never-engaged members | Must | S1 |
| **Chatbot** | | | |
| FR-040 | Chatbot SHALL respond to natural language queries about members (e.g., "Pull up Tre", "Who's been quiet?") | Must | S2 |
| FR-041 | Chatbot SHALL support pre-scripted query patterns with inline draft reply buttons | Must | S2 |
| **Reports** | | | |
| FR-050 | Reports tab SHALL display 5 trend charts: Active Community, At-Risk, Response Rate, Avg Response Time, Time Saved | Must | S1 |
| FR-051 | Time Saved Calculator SHALL display data-backed estimates with methodology tooltips | Must | S1 |
| FR-052 | Report time filter SHALL support 3m, 6m, 1y periods | Must | S1 |

---

## Non-Functional Requirements

| ID | Requirement | Metric | Notes |
|----|-------------|--------|-------|
| NFR-001 | Page load time | < 2 seconds | Single HTML file, no external API calls at load |
| NFR-002 | Scraper completion time | < 10 minutes | 267 members with infinite scroll + rate limiting |
| NFR-003 | Scraper reliability | 95%+ daily success rate | Auth fallback chain handles most failures |
| NFR-004 | Data freshness | < 24 hours stale | Daily scrape at 06:00 CT |
| NFR-005 | Credential storage | Zero plaintext on disk | macOS Keychain only |
| NFR-006 | PII scope | Member names + Skool profile URLs only | No health data in scraped member list |
| NFR-007 | Offline capability | Full functionality with last-scraped data | HTML reads local JSON |
| NFR-008 | Browser compatibility | Chrome/Safari latest | Desktop-first, no IE |
| NFR-009 | Scraper rate limiting | > 1.5s between scroll requests | Respect Skool's servers |
| NFR-010 | Cookie persistence | Survive browser restarts | Saved to ~/.skool-cookies.json |

---

## Data Contracts

### Member (scraped from /members page)

```typescript
interface SkoolMember {
  name: string;                    // Display name from member card
  username?: string;               // @handle if available
  profileUrl: string;              // https://www.skool.com/@username
  avatarUrl?: string;              // CDN URL for profile image
  joinDate?: string;               // "Jan '26" or ISO date if parseable
  lastActive?: string;             // "2d ago", "Jan 25", relative or absolute
  level?: string;                  // Skool gamification level
  contributions?: number;          // Post/comment count
  role?: 'admin' | 'moderator' | 'member';
}
```

### Scrape Result (output file)

```typescript
interface ScrapeResult {
  community: string;               // "healthoptimization"
  scrapedAt: string;               // ISO 8601 timestamp
  scrapeMethod: 'profile' | 'password' | 'otp' | 'manual';
  cookieAge?: string;              // "3 days" — for staleness tracking
  totalMembers: number;            // Expected: 267
  members: SkoolMember[];          // Sorted alphabetically
}
```

### Enriched Member (CRM internal — combines scraped + thread data)

```typescript
interface CRMMember {
  // From scraper
  name: string;
  profileUrl: string;
  avatarUrl?: string;
  joinDate: string;
  lastActive: string;
  level: string;
  role: 'admin' | 'moderator' | 'member';

  // From parsed threads
  summary?: string;                // Health journey summary
  labResults?: string[];           // ["Low WBC", "High ALT/AST", "HCT 50%"]
  protocols?: string[];            // ["Taurine", "BSO 15ml 2x/day", "Inflamed gut formula"]
  jackRecommendations?: string[];  // Jack's past advice, most recent first
  threadUrl?: string;              // Deep link to their Skool thread

  // Calculated
  status: 'active' | 'at-risk' | 'awaiting-reply' | 'new' | 'never-engaged';
  responseRate: number;            // 0-100, % of threads Jack replied to
  avgResponseTime: string;         // "4h", "1d", "< 1h"
  engagementLevel: 'high' | 'moderate' | 'low';
  totalComments: number;
  jackReplyCount: number;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  date: string;
  type: 'post' | 'comment' | 'lab-update' | 'jack-reply';
  excerpt: string;
  threadUrl?: string;
}
```

### Status Calculation Rules

```typescript
function calculateStatus(member: CRMMember): Status {
  const daysSinceActive = daysBetween(member.lastActive, now());

  if (member.totalComments === 0 && daysSinceActive > 14)
    return 'never-engaged';

  if (hasUnrepliedThread(member))
    return 'awaiting-reply';

  if (daysSinceActive > 30)
    return 'at-risk';  // "gone quiet"

  if (daysSinceActive <= 14 && daysBetween(member.joinDate, now()) <= 30)
    return 'new';

  return 'active';
}
```

### Draft Reply Context (input to LLM)

```typescript
interface DraftReplyContext {
  memberName: string;
  healthSummary: string;
  labHighlights: string[];         // Most recent labs
  activeProtocols: string[];       // Current supplements/routines
  pastRecommendations: string[];   // Jack's previous advice
  lastMessage: string;             // Member's most recent post
  replyType: 'reply' | 'check-in' | 'onboarding';
}
```

---

## Security Threat Matrix

| Asset | Threat | Likelihood | Impact | Mitigation |
|-------|--------|-----------|--------|------------|
| Skool password | Plaintext exposure on disk | Medium | High | Store in macOS Keychain only. `security find-generic-password` at runtime. Never write to env files or JSON. |
| Gmail App Password | Plaintext exposure | Medium | High | macOS Keychain. Scoped to IMAP-only (Gmail App Password, not main password). |
| Skool session cookies | Stolen from `~/.skool-cookies.json` | Low | Medium | File permissions 600 (owner-only). Contains session tokens, not credentials. Expire in 7-30 days. |
| Member PII | Names exposed in JSON files | Low | Low | Names are semi-public (visible to all community members on Skool). No health data in scraped list. Health data stays in parsed-threads.json which is already local. |
| Health data (parsed threads) | Sensitive medical information in JSON | Low | High | Local files only, never committed to git. `.gitignore` the entire `skool-data/` directory. Future: encrypted at rest in Supabase with RLS. |
| Browser profile | Contains all Skool auth state | Low | Medium | Stored in Playwright's `userDataDir`. Local to machine. Not synced to cloud. |
| Draft replies | AI-generated medical advice | Medium | Medium | Clear "AI-generated — review before sending" label. Jack always reviews before copying to Skool. Never auto-sent. |
| CRM access | Unauthorized access to member data | Low (MVP) | Medium | MVP: local HTML file, no network access needed. V1.0: Supabase Auth with email allowlist (Jack + Phoebe only). |

### L's Assessment

> "The primary risk is credential management — Skool password and Gmail App Password must never touch disk in plaintext. macOS Keychain is the correct mitigation. Health data in parsed-threads.json is the most sensitive asset; it should never leave the local machine until encrypted storage is in place (V1.0 Supabase with RLS)."

---

## Scraper Technical Specification

### Persistent Browser Profile

```typescript
// PRIMARY auth method — reuses existing Chrome session
const context = await chromium.launchPersistentContext(
  path.join(os.homedir(), '.skool-browser-profile'), {
    headless: false,  // Skool detects headless
    viewport: { width: 1440, height: 900 },
    userAgent: CHROME_UA,
  }
);
```

**Why persistent profile over cookies file:**
- Stores full browser state (localStorage, sessionStorage, IndexedDB)
- Survives Skool's cookie rotation
- No manual cookie import/export
- Chrome-like fingerprint (canvas, WebGL, fonts)

### OTP/IMAP Login Flow

```typescript
async function otpLogin(page: Page): Promise<boolean> {
  // 1. Click "Log in with a code"
  await page.click('text="Log in with a code"');

  // 2. Enter Jack's email
  await page.fill('input[type="email"]', getFromKeychain('skool-email'));
  await page.click('button:has-text("Send code")');

  // 3. Fetch code from Gmail via IMAP
  const code = await fetchOtpFromGmail({
    user: getFromKeychain('gmail-user'),
    password: getFromKeychain('gmail-app-password'),
    subject: 'Skool',           // Match Skool's OTP email subject
    maxWaitMs: 60_000,          // 60 second timeout
    pollIntervalMs: 3_000,      // Check every 3 seconds
  });

  if (!code) return false;

  // 4. Enter code
  await page.fill('input[placeholder*="code"]', code);
  await page.click('button:has-text("Log in")');

  // 5. Verify navigation away from login
  await page.waitForURL(url => !url.includes('/login'), { timeout: 10_000 });
  return true;
}
```

### Gmail IMAP Fetch

```typescript
async function fetchOtpFromGmail(opts: {
  user: string;
  password: string;       // Gmail App Password (not main password)
  subject: string;
  maxWaitMs: number;
  pollIntervalMs: number;
}): Promise<string | null> {
  // Use imapflow (lightweight IMAP client)
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: opts.user, pass: opts.password },
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  const startTime = Date.now();
  try {
    while (Date.now() - startTime < opts.maxWaitMs) {
      // Search for recent Skool emails
      const messages = await client.search({
        from: 'skool.com',
        since: new Date(Date.now() - 120_000), // Last 2 minutes
        subject: opts.subject,
      });

      if (messages.length > 0) {
        const msg = await client.fetchOne(messages[messages.length - 1], { source: true });
        const code = extractCodeFromEmail(msg.source.toString());
        if (code) return code;
      }

      await sleep(opts.pollIntervalMs);
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return null;
}
```

### macOS Keychain Access

```typescript
import { execSync } from 'child_process';

function getFromKeychain(service: string): string {
  return execSync(
    `security find-generic-password -s "${service}" -w`,
    { encoding: 'utf-8' }
  ).trim();
}

// Setup (run once manually):
// security add-generic-password -s "skool-email" -a "jack" -w "jack@email.com"
// security add-generic-password -s "skool-password" -a "jack" -w "thepassword"
// security add-generic-password -s "gmail-user" -a "jack" -w "jack@gmail.com"
// security add-generic-password -s "gmail-app-password" -a "jack" -w "xxxx-xxxx-xxxx-xxxx"
```

### DOM Selector Strategy

**Problem:** Skool's member list DOM structure is unknown until first authenticated scrape.

**Approach:** Progressive selector discovery.

```typescript
// Phase 1: Screenshot + HTML dump (already implemented)
// → Human reviews debug/members-page.html to identify selectors

// Phase 2: Once selectors discovered, replace generic fallbacks with specific ones
// Current generic selectors (will be replaced):
const SELECTOR_STRATEGIES = [
  // Specific (add after first successful scrape)
  // e.g., '[data-testid="member-row"]', '.styled-member-card', etc.

  // Generic fallbacks (current)
  '[class*="MemberCard"]',
  'a[href*="/@"]',
  '[class*="member-list"] > div',
];
```

### Infinite Scroll Handling

```typescript
async function scrollAndCollect(page: Page): Promise<SkoolMember[]> {
  const members = new Map<string, SkoolMember>(); // Dedup by name
  let noNewCount = 0;

  while (noNewCount < 3 && members.size < 300) {  // Safety: 300 max
    const before = members.size;

    const batch = await page.evaluate(() => extractVisibleMembers());
    for (const m of batch) members.set(m.name, m);

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500); // Rate limit: NFR-009

    // Try "Load more" button
    const loadMore = page.locator('button:has-text("Load more"), button:has-text("Show more")');
    if (await loadMore.count() > 0 && await loadMore.first().isVisible()) {
      await loadMore.first().click();
      await sleep(2000);
    }

    noNewCount = members.size === before ? noNewCount + 1 : 0;
  }

  return Array.from(members.values());
}
```

### launchd Scheduling

```xml
<!-- ~/Library/LaunchAgents/com.aeon.skool-scraper.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aeon.skool-scraper</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>tsx</string>
        <string>/Users/michaelenriquez/Code/clawdbot/skills/skool-scraper/scripts/scrape-members.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/michaelenriquez/Code/clawdbot/skills/skool-scraper/scripts</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/skool-scraper.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/skool-scraper-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>/Users/michaelenriquez</string>
    </dict>
</dict>
</plist>
```

---

## LLM Integration (Draft Replies)

### MVP: Template-Based Drafts

MVP draft replies use structured templates, not live LLM calls. This is sufficient for the demo and first month of use.

```typescript
function generateDraft(ctx: DraftReplyContext): string {
  const greeting = `Hey ${ctx.memberName},`;

  switch (ctx.replyType) {
    case 'reply':
      return `${greeting} thanks for the update. Based on your ${ctx.labHighlights[0] || 'recent labs'} and your current protocol (${ctx.activeProtocols.join(', ')}), here's what I'd suggest...`;

    case 'check-in':
      return `${greeting} haven't heard from you in a bit — wanted to check in. How's the ${ctx.activeProtocols[0] || 'protocol'} going? Any changes in symptoms or labs since we last talked?`;

    case 'onboarding':
      return `${greeting} welcome to the community! I noticed you joined recently — would love to help you get started. Do you have any recent lab work you'd like me to take a look at?`;
  }
}
```

### V1.0: LLM-Powered Drafts (Haiku)

```typescript
// Future: Anthropic API via claude-haiku-4-5
const draft = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 500,
  system: `You are drafting a reply for Jack Schroder, a health optimization practitioner.
    Write in Jack's voice: direct, knowledgeable, encouraging, uses "bro" casually.
    Reference specific labs and protocols from the member's history.
    Keep it conversational — this is a Skool community post, not a medical report.`,
  messages: [{ role: 'user', content: JSON.stringify(ctx) }],
});
```

**Cost estimate (V1.0):** ~106 drafts/month x ~500 tokens/draft = 53K tokens/month. At Haiku pricing ($0.80/MTok input, $4/MTok output) ≈ **$0.25/month**. Negligible.

---

## Acceptance Criteria

```gherkin
Feature: Skool Member Scraping

  Scenario: Successful daily scrape with persistent profile
    Given the persistent browser profile has a valid Skool session
    When the scraper runs at 06:00 CT
    Then members-list.json is written with 267 ± 10 members
    And scrapedAt timestamp is within the last hour
    And debug screenshot is saved to skool-data/debug/

  Scenario: Session expired, password fallback
    Given the persistent profile session has expired
    And Skool password is stored in macOS Keychain under "skool-password"
    When the scraper detects redirect to /login
    Then it retrieves the password from Keychain
    And logs in via email + password form
    And proceeds with scrape normally

  Scenario: Password fails, OTP fallback
    Given password login fails (wrong password or Skool rejects)
    And Gmail App Password is stored in Keychain under "gmail-app-password"
    When the scraper falls back to OTP login
    Then it clicks "Log in with a code" on Skool
    And enters Jack's email address
    And fetches the OTP code from Gmail via IMAP within 60 seconds
    And enters the code to complete login

  Scenario: All auth methods fail
    Given persistent profile, password, and OTP all fail
    When the scraper exhausts all fallbacks
    Then it sends a Discord alert via Makima with error details
    And exits with code 1
    And the CRM displays "Last sync: X days ago" warning

Feature: CRM Dashboard

  Scenario: Daily check-in (happy path)
    Given member data is less than 24 hours old
    When Jack opens the CRM
    Then he sees 4 signal cards with current counts and deltas
    And "Members Needing Attention" shows at-risk members
    And "Threads Needing Reply" shows unanswered threads
    And page loads in under 2 seconds

  Scenario: Stale data warning
    Given member data is more than 48 hours old
    When Jack opens the CRM
    Then a yellow banner shows "Data may be out of date. Last sync: X days ago"
    And a "Sync Now" button triggers a manual scrape

Feature: Member Context Card

  Scenario: View member with full history
    Given Tre Ogden has 101 comments and 49 Jack replies
    When Jack clicks Tre's name in the member table
    Then a detail overlay shows: health summary, lab results, protocols, Jack's recommendations
    And response rate shows 100% (Jack replied to this thread)
    And recent activity shows last 2-3 interactions
    And "Draft Reply" button is visible

Feature: Draft Reply

  Scenario: Generate and copy draft
    Given Jack is viewing Tre's detail card
    When he clicks "Draft Reply"
    Then a draft appears referencing Tre's specific labs and protocols
    And the draft is labeled "AI-generated — review before sending"
    When he clicks "Copy to Clipboard"
    Then plain text (no HTML) is copied to system clipboard
    When he clicks "Open in Skool"
    Then Tre's thread opens in a new browser tab
```

---

## Dependencies

| Dependency | Version | Purpose | Install |
|------------|---------|---------|---------|
| playwright | ^1.40 | Browser automation for scraping | `pnpm add playwright` |
| imapflow | ^1.0 | Gmail IMAP for OTP code fetching | `pnpm add imapflow` |
| tsx | ^4.0 | TypeScript execution for scraper | `pnpm add -D tsx` |

**Infrastructure:**
- macOS Keychain (built-in) — credential storage
- launchd (built-in) — daily scheduling
- Discord webhook (existing) — Makima alerting

**No new infrastructure for MVP.** All local, all free.

---

## Out of Scope (This Version)

| Feature | Deferred To | Trigger |
|---------|-------------|---------|
| Supabase backend | V1.0 | After MVP validated with Jack for 2 weeks |
| User authentication | V1.0 | When hosting on Vercel (currently local file) |
| Live LLM draft replies | V1.0 | After template-based drafts validated |
| Skool DM automation | V1.1 | After scraper proven reliable for 30 days |
| Mobile optimization | V1.1 | After desktop workflow validated |
| Individual member profile scraping | V1.0 | After member list scrape works reliably |
| Multi-community support | V2 | If Jack adds second community or we sell to other Skool owners |
| Real-time sync (webhooks) | Never (V2 if Skool adds API) | Skool has no webhook/API support |

---

## Rollback Plan

| Component | Rollback Method |
|-----------|----------------|
| Scraper | `git revert` the scrape-members.ts change. Previous members-list.json still valid. |
| launchd agent | `launchctl unload ~/Library/LaunchAgents/com.aeon.skool-scraper.plist` |
| CRM prototype | Single HTML file — revert with `git checkout`. No database, no migrations. |
| Keychain entries | `security delete-generic-password -s "skool-password"` per entry |
| Browser profile | `rm -rf ~/.skool-browser-profile/` — next run creates fresh |
| Cookies file | `rm ~/.skool-cookies.json` — next run triggers interactive login |

**Nuclear rollback:** Delete `members-list.json` and `parsed-threads.json`. CRM shows empty state. Scraper can rebuild from scratch with one manual login.

---

## Build Sprints

### Sprint 1: Scraper + Data Pipeline (Week 1)
1. Refactor scraper to use persistent browser profile (`userDataDir`)
2. Add password re-login fallback (Keychain integration)
3. Add OTP/IMAP login fallback
4. First successful authenticated scrape → discover real DOM selectors
5. Replace generic selectors with discovered ones
6. Validate: 267 members in `members-list.json`

### Sprint 2: Wire Real Data into Prototype (Week 1-2)
1. Write data merger: `members-list.json` + `parsed-threads.json` → enriched members
2. Replace 8 mock members in prototype with real 267-member data
3. Calculate real statuses (active/at-risk/awaiting/new/never-engaged)
4. Wire chatbot to query real member data
5. Set up launchd daily schedule
6. Validate: CRM loads with real data, all filters work

### Sprint 3: Polish + Delivery (Week 2)
1. Add stale data warning banner
2. Add Discord alerting for scraper failures
3. Template-based draft replies using real member context
4. Final QA pass on all features from PRD
5. Deliver to Jack with setup instructions

---

## Risk Mitigations (Pre-Mortem)

### Tigers Addressed

1. **launchd + Headed Browser Conflict** (HIGH)
   - **Risk:** launchd can't run headed browsers without a GUI session. Skool blocks headless.
   - **Mitigation:** Run scraper on dedicated Mac Mini (always-on, logged-in GUI session). launchd + `headless: false` works natively when WindowServer is available. Mac Mini also runs OpenClaw/Makima — shared infrastructure.
   - **Interim (before Mac Mini):** Run scraper manually or via cron on Sensei's MacBook when awake. Accept stale data when laptop is asleep.

2. **DOM Selector Fragility** (MEDIUM)
   - **Risk:** Skool can change DOM at any time. Scraper silently returns 0 members.
   - **Mitigation:** Post-scrape validation gate:
     ```typescript
     if (members.length < 200) {
       // Selector failure — don't overwrite good data
       console.error(`⚠️ Only found ${members.length} members (expected ~267)`);
       await saveDebugArtifacts(page); // screenshot + HTML
       await alertMakima(`Scraper selector failure: ${members.length} members found`);
       process.exit(1); // Don't overwrite members-list.json
     }
     ```
   - Added to: Sprint 1, after selector discovery

### Accepted Risks

1. **Single Machine Dependency** (ELEPHANT)
   - **Risk:** MVP runs on Sensei's MacBook. Product stops if laptop unavailable.
   - **Accepted because:** Mac Mini purchase planned within 30 days. Until then, CRM degrades gracefully (stale data warning, not total failure). Migration trigger: if laptop unavailability exceeds 48 hours OR Jack signs contract, whichever comes first.

### Pre-Mortem Run
- Date: 2026-02-27
- Mode: deep
- Tigers: 2 (both mitigated)
- Elephants: 1 (accepted with migration trigger)
- Paper Tigers: 3 (OTP timing, health data PII, draft reply liability)

---

## Open Technical Questions

- [ ] What are the actual DOM selectors on Skool's /members page? (Blocked until first authenticated scrape)
- [ ] Does Skool's "Log in with a code" button have a stable selector, or does it vary?
- [ ] What's the exact email subject line for Skool OTP codes? (Need to observe one)
- [ ] Does Skool throttle or block after N rapid page loads? (Need to test rate limit)
- [ ] Can Playwright's persistent context run headless on Skool, or does it detect headless mode?
- [ ] What's the deep link URL format for individual Skool threads? (For "Open in Skool" button)
