# Chat Tools

War Room Dojo chat now supports built-in tools that agents can use during conversations.

## Clinical Trials Search

Search ClinicalTrials.gov directly from chat conversations.

### Usage

Simply ask about clinical trials in natural language:

**Examples:**
- "Search clinical trials for lung cancer"
- "Find trials about diabetes"
- "Search trials for breast cancer phase 3"
- "Find recruiting trials for glioblastoma"

### How It Works

1. The chat endpoint (`/api/chat`) detects trial-related queries
2. Extracts search parameters from natural language:
   - **Condition**: Detected after "for", "about", "on"
   - **Phase**: "phase 3", "phase III", etc.
   - **Status**: "recruiting", etc.
3. Calls Python `search_trials()` function from `engine/clinical_trials.py`
4. Formats and streams results back to chat

### API Details

**Backend:** `/app/api/chat/route.ts`
**Python Module:** `/engine/clinical_trials.py`
**Data Source:** ClinicalTrials.gov API v2 (public, no auth required)

### Response Format

Results include:
- **NCT ID** with status icon (🟢 recruiting, ✅ completed, etc.)
- **Title** of the study
- **Phase** (1, 2, 3, 4)
- **Sponsor** organization
- **Conditions** being studied
- **Interventions** (drugs, treatments)
- **Enrollment** numbers
- **Direct link** to ClinicalTrials.gov

### Example Response

```
Found 2 trials for 'lung cancer':

**NCT03906071** ✅ COMPLETED
  Phase 3 Study of Sitravatinib Plus Nivolumab vs Docetaxel
  Phase: Phase 3
  Sponsor: Mirati Therapeutics Inc.
  Conditions: Non-Small Cell Lung Cancer
  Interventions: Nivolumab, Sitravatinib, Docetaxel
  Enrollment: 577
  https://clinicaltrials.gov/study/NCT03906071
```

### Technical Notes

- Rate limit: ~3 requests/second (be polite to ClinicalTrials.gov)
- Default: Returns top 5 results
- Results are streamed for real-time display
- Python subprocess spawned per search (stateless)

### Adding More Tools

To add additional chat tools:

1. Create Python module in `/engine/`
2. Add detection logic in `/app/api/chat/route.ts` (see `isTrialQuery`)
3. Create stream handler function (see `streamTrialSearch`)
4. Document here

### Future Enhancements

- [ ] PubMed paper search
- [ ] Drug information lookup
- [ ] Company/sponsor research
- [ ] Trial comparison
- [ ] Save/bookmark trials
