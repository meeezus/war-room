import { toast } from "sonner";

// Event types that trigger toasts
const CRITICAL_EVENTS = [
  "mission_failed",
  "step_failed",
  "step_stale",
] as const;

// Colors per event type
const EVENT_COLORS: Record<string, string> = {
  mission_failed: "#ef4444",
  step_failed: "#ef4444",
  step_stale: "#eab308",
};

interface ToastEvent {
  event_type: string;
  title: string;
  agent_id: string | null;
}

export function triggerEventToast(event: ToastEvent) {
  const isCritical = CRITICAL_EVENTS.includes(
    event.event_type as (typeof CRITICAL_EVENTS)[number]
  );
  if (!isCritical) return;

  const color = EVENT_COLORS[event.event_type] ?? "#ef4444";
  const label = event.event_type.replace(/_/g, " ");
  const title = label.charAt(0).toUpperCase() + label.slice(1);

  toast.error(title, {
    description: event.title + (event.agent_id ? ` (${event.agent_id})` : ""),
    duration: 5000,
    style: {
      borderLeft: `3px solid ${color}`,
    },
  });
}

export function triggerAgentOfflineToast(agentName: string) {
  toast.warning("Agent Offline", {
    description: `${agentName} went offline`,
    duration: 5000,
    style: {
      borderLeft: "3px solid #ef4444",
    },
  });
}
