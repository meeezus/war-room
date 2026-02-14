"""Shogunate Engine configuration."""

import os

# Supabase client
# In production, initialized from env vars. For testing, this gets mocked.
_supabase_url = os.getenv("SUPABASE_URL", "")
_supabase_key = os.getenv("SUPABASE_KEY", "")

supabase = None
if _supabase_url and _supabase_key:
    from supabase import create_client
    supabase = create_client(_supabase_url, _supabase_key)


# Moonshot client placeholder
moonshot = None


# Three-tier model strategy
CHEAP_MODEL = os.getenv("CHEAP_MODEL", "claude-haiku-4-5-20251001")       # proposals, memory extraction
WORKER_MODEL = os.getenv("WORKER_MODEL", "claude-sonnet-4-5-20250929")    # default execution
ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "claude-opus-4-6")   # complex multi-domain

# Default timeout for steps in minutes
DEFAULT_TIMEOUT_MINUTES = 30

# Daimyo registry with skill paths
DAIMYO_REGISTRY: dict[str, dict] = {
    "ed": {
        "name": "Ed",
        "domain": "engineering",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Ed-SKILL.md"),
    },
    "light": {
        "name": "Light",
        "domain": "product",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Light-SKILL.md"),
    },
    "toji": {
        "name": "Toji",
        "domain": "commerce",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Toji-SKILL.md"),
    },
    "power": {
        "name": "Makima",
        "domain": "influence",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Makima-SKILL.md"),
    },
    "major": {
        "name": "Major",
        "domain": "operations",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Major-SKILL.md"),
    },
}
