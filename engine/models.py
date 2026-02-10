"""Shogunate Engine Pydantic models and enums."""

from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class StepStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class MissionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatusEnum(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"


class Step(BaseModel):
    id: str
    mission_id: str
    description: str
    assigned_to: str  # daimyo_id
    status: StepStatus = StepStatus.QUEUED
    kind: str = "general"
    output: Optional[str] = None
    error: Optional[str] = None
    timeout_minutes: int = 30
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class Mission(BaseModel):
    id: str
    proposal_id: Optional[str] = None
    title: str
    assigned_to: str  # daimyo_id
    status: MissionStatus = MissionStatus.PENDING
    steps: list[Step] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AgentStatus(BaseModel):
    daimyo_id: str
    status: AgentStatusEnum = AgentStatusEnum.IDLE
    current_mission_id: Optional[str] = None
    last_heartbeat: Optional[datetime] = None
