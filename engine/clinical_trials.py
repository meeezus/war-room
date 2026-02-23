"""ClinicalTrials.gov v2 API client.

Searches the ClinicalTrials.gov public API for clinical studies.
Used by research workers (Light's strategy team, Ed's Scout) during
missions involving drug pipelines, competitive intelligence, or
medical research landscape analysis.

API docs: https://clinicaltrials.gov/data-api/api
- Free, no API key required
- Rate limit: ~3 req/sec (be polite)
- Returns JSON with study protocol sections
"""

from __future__ import annotations
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

API_BASE = "https://clinicaltrials.gov/api/v2"


@dataclass
class Study:
    """A single clinical trial study."""

    nct_id: str
    title: str | None = None
    status: str | None = None  # e.g., "RECRUITING", "COMPLETED"
    phase: str | None = None  # e.g., "PHASE3", "PHASE1|PHASE2"
    conditions: list[str] = field(default_factory=list)
    interventions: list[str] = field(default_factory=list)
    sponsor: str | None = None
    start_date: str | None = None
    completion_date: str | None = None
    enrollment: int | None = None
    url: str | None = None

    @property
    def phases_display(self) -> str:
        """Human-readable phase string."""
        if not self.phase:
            return "N/A"
        return self.phase.replace("PHASE", "Phase ").replace("|", "/")


@dataclass
class SearchResult:
    """Result of a clinical trials search."""

    total_count: int = 0
    studies: list[Study] = field(default_factory=list)
    query: str | None = None
    next_page_token: str | None = None
    error: str | None = None

    @property
    def found(self) -> bool:
        return self.total_count > 0 and len(self.studies) > 0


def _parse_study(raw: dict) -> Study:
    """Parse a single study from the API response.

    The v2 API nests data under protocolSection with sub-modules.
    """
    proto = raw.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    status_mod = proto.get("statusModule", {})
    design = proto.get("designModule", {})
    conditions_mod = proto.get("conditionsModule", {})
    interventions_mod = proto.get("armsInterventionsModule", {})
    sponsor_mod = proto.get("sponsorCollaboratorsModule", {})

    # Extract interventions list
    intervention_list = []
    for iv in interventions_mod.get("interventions", []):
        name = iv.get("name", "")
        iv_type = iv.get("type", "")
        if name:
            intervention_list.append(f"{iv_type}: {name}" if iv_type else name)

    # Extract sponsor
    lead_sponsor = sponsor_mod.get("leadSponsor", {})

    nct_id = ident.get("nctId", raw.get("nctId", "unknown"))

    return Study(
        nct_id=nct_id,
        title=ident.get("briefTitle"),
        status=status_mod.get("overallStatus"),
        phase=design.get("phases", [None])[0] if design.get("phases") else None,
        conditions=conditions_mod.get("conditions", []),
        interventions=intervention_list,
        sponsor=lead_sponsor.get("name"),
        start_date=status_mod.get("startDateStruct", {}).get("date"),
        completion_date=status_mod.get("completionDateStruct", {}).get("date"),
        enrollment=design.get("enrollmentInfo", {}).get("count"),
        url=f"https://clinicaltrials.gov/study/{nct_id}",
    )


def search_trials(
    *,
    condition: str | None = None,
    term: str | None = None,
    intervention: str | None = None,
    sponsor: str | None = None,
    status: str | list[str] | None = None,
    phase: str | list[str] | None = None,
    page_size: int = 10,
    page_token: str | None = None,
) -> SearchResult:
    """Search ClinicalTrials.gov for studies.

    Args:
        condition: Disease or condition (e.g., "diabetes", "breast cancer")
        term: General search term (searches all fields)
        intervention: Drug or intervention name (e.g., "pembrolizumab")
        sponsor: Sponsor organization name
        status: Filter by status. One or list of:
            RECRUITING, NOT_YET_RECRUITING, ACTIVE_NOT_RECRUITING,
            COMPLETED, TERMINATED, WITHDRAWN, SUSPENDED
        phase: Filter by phase. One or list of:
            EARLY_PHASE1, PHASE1, PHASE2, PHASE3, PHASE4, NA
        page_size: Results per page (max 100)
        page_token: Token for pagination from previous SearchResult

    Returns:
        SearchResult with studies and metadata.
    """
    params: dict[str, str] = {
        "format": "json",
        "pageSize": str(min(page_size, 100)),
    }

    # Build query.cond, query.term, query.intr, query.spons
    if condition:
        params["query.cond"] = condition
    if term:
        params["query.term"] = term
    if intervention:
        params["query.intr"] = intervention
    if sponsor:
        params["query.spons"] = sponsor

    # Status filter (pipe-separated for multiple)
    if status:
        if isinstance(status, list):
            params["filter.overallStatus"] = "|".join(status)
        else:
            params["filter.overallStatus"] = status

    # Phase filter
    if phase:
        if isinstance(phase, list):
            params["filter.phase"] = "|".join(phase)
        else:
            params["filter.phase"] = phase

    if page_token:
        params["pageToken"] = page_token

    # Request specific fields to reduce payload
    params["fields"] = "|".join([
        "NCTId",
        "BriefTitle",
        "OverallStatus",
        "Phase",
        "Condition",
        "InterventionName",
        "InterventionType",
        "LeadSponsorName",
        "StartDate",
        "CompletionDate",
        "EnrollmentCount",
    ])

    url = f"{API_BASE}/studies?{urllib.parse.urlencode(params)}"
    query_desc = condition or term or intervention or "all"

    logger.info("Searching ClinicalTrials.gov: %s", query_desc)

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Shogunate-Engine/1.0")

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        studies = [_parse_study(s) for s in data.get("studies", [])]

        return SearchResult(
            total_count=data.get("totalCount", len(studies)),
            studies=studies,
            query=query_desc,
            next_page_token=data.get("nextPageToken"),
        )

    except urllib.error.HTTPError as e:
        msg = f"ClinicalTrials.gov API error: HTTP {e.code}"
        logger.error(msg)
        return SearchResult(query=query_desc, error=msg)

    except urllib.error.URLError as e:
        msg = f"ClinicalTrials.gov connection error: {e.reason}"
        logger.error(msg)
        return SearchResult(query=query_desc, error=msg)

    except (json.JSONDecodeError, TimeoutError) as e:
        msg = f"ClinicalTrials.gov response error: {e}"
        logger.error(msg)
        return SearchResult(query=query_desc, error=msg)


def get_study(nct_id: str) -> Study | None:
    """Fetch a single study by NCT ID.

    Args:
        nct_id: e.g., "NCT12345678"

    Returns:
        Study or None if not found.
    """
    url = f"{API_BASE}/studies/{nct_id}?format=json"

    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "Shogunate-Engine/1.0")

        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        return _parse_study(data)

    except urllib.error.HTTPError as e:
        if e.code == 404:
            logger.warning("Study not found: %s", nct_id)
            return None
        logger.error("API error fetching %s: HTTP %s", nct_id, e.code)
        return None

    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        logger.error("Error fetching %s: %s", nct_id, e)
        return None


def format_for_chat(result: SearchResult, max_studies: int = 5) -> str:
    """Format search results for chat/Daimyo consumption.

    Returns a concise, readable summary suitable for injection into
    a Daimyo or worker prompt.
    """
    if result.error:
        return f"Trial search failed: {result.error}"

    if not result.found:
        return f"No clinical trials found for '{result.query}'."

    lines = [f"Found {result.total_count} trials for '{result.query}':\n"]

    for study in result.studies[:max_studies]:
        status_icon = {
            "RECRUITING": "🟢",
            "ACTIVE_NOT_RECRUITING": "🟡",
            "COMPLETED": "✅",
            "NOT_YET_RECRUITING": "⏳",
            "TERMINATED": "🔴",
            "WITHDRAWN": "⚫",
            "SUSPENDED": "🟠",
        }.get(study.status or "", "❓")

        lines.append(f"**{study.nct_id}** {status_icon} {study.status or 'Unknown'}")
        if study.title:
            lines.append(f"  {study.title}")
        lines.append(f"  Phase: {study.phases_display}")
        if study.sponsor:
            lines.append(f"  Sponsor: {study.sponsor}")
        if study.conditions:
            lines.append(f"  Conditions: {', '.join(study.conditions[:3])}")
        if study.interventions:
            lines.append(f"  Interventions: {', '.join(study.interventions[:3])}")
        if study.enrollment:
            lines.append(f"  Enrollment: {study.enrollment}")
        lines.append(f"  {study.url}")
        lines.append("")

    if result.total_count > max_studies:
        lines.append(
            f"... and {result.total_count - max_studies} more. "
            f"Narrow search with condition/phase/status filters."
        )

    return "\n".join(lines)
