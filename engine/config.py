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


# Worker model for step execution
WORKER_MODEL = os.getenv("WORKER_MODEL", "claude-sonnet-4-20250514")

# Default timeout for steps in minutes
DEFAULT_TIMEOUT_MINUTES = 30

# Daimyo registry with skill paths
DAIMYO_REGISTRY: dict[str, dict] = {
    "ed": {
        "name": "Ed",
        "domain": "engineering",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Atlas-SKILL.md"),
    },
    "light": {
        "name": "Light",
        "domain": "product",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Sage-SKILL.md"),
    },
    "toji": {
        "name": "Toji",
        "domain": "commerce",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Vex-SKILL.md"),
    },
    "power": {
        "name": "Power",
        "domain": "influence",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Spark-SKILL.md"),
    },
    "major": {
        "name": "Major",
        "domain": "operations",
        "skill_path": os.path.expanduser("~/Shugyo/Shogunate/Daimyo/Bolt-SKILL.md"),
    },
}
