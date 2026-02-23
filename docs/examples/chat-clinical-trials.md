# Clinical Trials Search - Chat Examples

## Quick Examples

### Basic Search by Condition

**You:** Search clinical trials for lung cancer

**Agent:**
```
Found 472 trials for 'lung cancer':

**NCT03906071** ✅ COMPLETED
  Phase 3 Study of Sitravatinib Plus Nivolumab vs Docetaxel
  Phase: Phase 3
  Sponsor: Mirati Therapeutics Inc.
  ...
```

### Search with Phase Filter

**You:** Find phase 3 trials for diabetes

**Agent:** Returns Phase 3 diabetes trials

### Search for Recruiting Trials

**You:** Search recruiting trials for glioblastoma

**Agent:** Returns currently recruiting glioblastoma trials

### General Search

**You:** Clinical trials about Alzheimer's disease

**Agent:** Returns Alzheimer's trials

## Supported Query Patterns

The chat tool detects these patterns:

- `search clinical trials [for|about|on] <condition>`
- `find trials [for|about] <condition>`
- `clinical trial search <condition>`
- `search trials <condition>`

## Parameters Extracted

From natural language, the tool extracts:

| Parameter | Detection | Example |
|-----------|-----------|---------|
| **Condition** | After "for", "about", "on" | "trials **for diabetes**" |
| **Phase** | "phase N" or "phase III" | "**phase 3** trials" |
| **Status** | "recruiting" keyword | "**recruiting** trials" |
| **General term** | Fallback if no params | Uses full query minus trigger words |

## Technical Workflow

```
User message
   ↓
Detect: /search.*trial|clinical.*trial|find.*study/i
   ↓
Extract params from natural language
   ↓
Call Python: search_trials(**params)
   ↓
Format results via format_for_chat()
   ↓
Stream to user (SSE)
```

## Try It

1. Open War Room Dojo chat
2. Select any agent (Ed, Light, etc.)
3. Type: "Search clinical trials for KRAS G12C lung cancer"
4. Get instant results from ClinicalTrials.gov

## Data Source

- **API:** ClinicalTrials.gov API v2
- **Auth:** None required (public API)
- **Rate Limit:** ~3 req/sec
- **Coverage:** 400,000+ registered trials worldwide
