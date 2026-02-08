// Types

export interface Daimyo {
  id: string;
  name: string;
  title: string;
  emoji: string;
  level: number;
  status: "online" | "idle" | "busy" | "offline";
  currentTask?: string;
  domain: string;
  lastHeartbeat: Date;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "backlog" | "pending" | "in_progress" | "done";
  priority: "P0" | "P1" | "P2" | "P3";
  assignee?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface WarEvent {
  id: string;
  timestamp: Date;
  type:
    | "agent_action"
    | "user_request"
    | "success"
    | "warning"
    | "alert"
    | "tool_use"
    | "escalation"
    | "delegation";
  agent?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type TaskStatus = Task["status"];
export type DaimyoStatus = Daimyo["status"];

// Static Data

export const DAIMYO: Daimyo[] = [
  {
    id: "pip",
    name: "Pip",
    title: "Shogun",
    emoji: "\ud83d\udc3f\ufe0f",
    level: 4,
    status: "online",
    currentTask: "Overseeing operations",
    domain: "Command",
    lastHeartbeat: new Date(),
  },
  {
    id: "atlas",
    name: "Atlas",
    title: "Daimyo of Engineering",
    emoji: "\ud83c\udfdb\ufe0f",
    level: 2,
    status: "idle",
    domain: "Engineering",
    lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "sage",
    name: "Sage",
    title: "Daimyo of Product",
    emoji: "\ud83d\udccb",
    level: 2,
    status: "idle",
    domain: "Product",
    lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: "vex",
    name: "Vex",
    title: "Daimyo of Commerce",
    emoji: "\ud83d\udcbc",
    level: 2,
    status: "idle",
    domain: "Commerce",
    lastHeartbeat: new Date(Date.now() - 3 * 60 * 1000),
  },
  {
    id: "spark",
    name: "Spark",
    title: "Daimyo of Influence",
    emoji: "\u2728",
    level: 2,
    status: "idle",
    domain: "Influence",
    lastHeartbeat: new Date(Date.now() - 8 * 60 * 1000),
  },
  {
    id: "bolt",
    name: "Bolt",
    title: "Daimyo of Operations",
    emoji: "\u26a1",
    level: 2,
    status: "offline",
    domain: "Operations",
    lastHeartbeat: new Date(Date.now() - 60 * 60 * 1000),
  },
];

export const INITIAL_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Design landing page wireframes",
    description: "Create initial wireframe concepts for the public-facing site",
    status: "backlog",
    priority: "P2",
    assignee: "sage",
    tags: ["design", "website"],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-2",
    title: "Set up CI/CD pipeline",
    status: "backlog",
    priority: "P1",
    tags: ["infra", "devops"],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-3",
    title: "Research competitor pricing",
    status: "pending",
    priority: "P2",
    assignee: "vex",
    tags: ["research", "strategy"],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-4",
    title: "Draft social media calendar",
    status: "pending",
    priority: "P3",
    assignee: "spark",
    tags: ["marketing", "content"],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-5",
    title: "Implement authentication system",
    status: "in_progress",
    priority: "P0",
    assignee: "atlas",
    tags: ["auth", "backend"],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    id: "task-6",
    title: "Write product requirements doc",
    status: "in_progress",
    priority: "P1",
    assignee: "sage",
    tags: ["product", "documentation"],
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: "task-7",
    title: "Deploy monitoring stack",
    status: "in_progress",
    priority: "P1",
    assignee: "bolt",
    tags: ["infra", "monitoring"],
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "task-8",
    title: "Set up error tracking",
    status: "done",
    priority: "P1",
    assignee: "atlas",
    tags: ["infra", "monitoring"],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-9",
    title: "Design brand guidelines",
    status: "done",
    priority: "P2",
    assignee: "spark",
    tags: ["design", "branding"],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "task-10",
    title: "Audit security posture",
    status: "backlog",
    priority: "P1",
    tags: ["security", "audit"],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export const INITIAL_EVENTS: WarEvent[] = [
  {
    id: "evt-1",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    type: "agent_action",
    agent: "pip",
    message: "Morning standup initiated. All Daimyo summoned.",
  },
  {
    id: "evt-2",
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    type: "delegation",
    agent: "pip",
    message: "Delegated auth implementation to Atlas (P0).",
  },
  {
    id: "evt-3",
    timestamp: new Date(Date.now() - 35 * 60 * 1000),
    type: "tool_use",
    agent: "atlas",
    message: "Scaffolded JWT middleware and session store.",
  },
  {
    id: "evt-4",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    type: "success",
    agent: "spark",
    message: "Brand guidelines v1 approved and published.",
  },
  {
    id: "evt-5",
    timestamp: new Date(Date.now() - 20 * 60 * 1000),
    type: "warning",
    agent: "bolt",
    message: "Monitoring agent heartbeat missed -- investigating.",
  },
  {
    id: "evt-6",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    type: "user_request",
    message: "Sensei requested competitor analysis by EOD.",
  },
  {
    id: "evt-7",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    type: "agent_action",
    agent: "vex",
    message: "Started competitor pricing research across 5 platforms.",
  },
  {
    id: "evt-8",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    type: "alert",
    agent: "bolt",
    message: "Operations agent went offline. Last heartbeat: 60m ago.",
  },
];

// Helper to get Daimyo by ID
export function getDaimyoById(id: string): Daimyo | undefined {
  return DAIMYO.find((d) => d.id === id);
}

// Status color mapping
export const STATUS_COLORS: Record<Daimyo["status"], string> = {
  online: "#10b981",
  idle: "#eab308",
  busy: "#ef4444",
  offline: "#6b7280",
};

// Priority color mapping
export const PRIORITY_COLORS: Record<Task["priority"], string> = {
  P0: "#ef4444",
  P1: "#f97316",
  P2: "#eab308",
  P3: "rgba(255, 255, 255, 0.4)",
};

// Event type color mapping
export const EVENT_TYPE_COLORS: Record<WarEvent["type"], string> = {
  agent_action: "#3b82f6",
  user_request: "#a855f7",
  success: "#10b981",
  warning: "#eab308",
  alert: "#ef4444",
  tool_use: "#6366f1",
  escalation: "#f97316",
  delegation: "#06b6d4",
};

// Column definitions for kanban
export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];
