"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { Event, AgentStatus, Mission, Step, Project, Task } from "@/lib/types"
import { triggerEventToast, triggerAgentOfflineToast } from "@/lib/toast-events"

const REALTIME_ENABLED = process.env.NEXT_PUBLIC_ENABLE_REALTIME !== "false"

// ---------------------------------------------------------------------------
// useRealtimeEvents
// ---------------------------------------------------------------------------

export function useRealtimeEvents(initialEvents: Event[]): Event[] {
  const [events, setEvents] = useState(initialEvents)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel: RealtimeChannel = client
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const newEvent = payload.new as Event
          setEvents((prev) => [newEvent, ...prev])
          triggerEventToast(newEvent)
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return events
}

// ---------------------------------------------------------------------------
// useRealtimeAgents
// ---------------------------------------------------------------------------

export function useRealtimeAgents(initialAgents: AgentStatus[]): AgentStatus[] {
  const [agents, setAgents] = useState(initialAgents)

  useEffect(() => {
    setAgents(initialAgents)
  }, [initialAgents])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel: RealtimeChannel = client
      .channel("agents-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agent_status" },
        (payload) => {
          const updated = payload.new as AgentStatus
          const old = payload.old as Partial<AgentStatus>
          if (updated.status === "offline" && old.status !== "offline") {
            triggerAgentOfflineToast(updated.display_name)
          }
          setAgents((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          )
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_status" },
        (payload) => {
          setAgents((prev) => [...prev, payload.new as AgentStatus])
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return agents
}

// ---------------------------------------------------------------------------
// useRealtimeMissions
// ---------------------------------------------------------------------------

export function useRealtimeMissions(initialMissions: Mission[]): Mission[] {
  const [missions, setMissions] = useState(initialMissions)

  useEffect(() => {
    setMissions(initialMissions)
  }, [initialMissions])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel: RealtimeChannel = client
      .channel("missions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "missions" },
        (payload) => {
          setMissions((prev) => [...prev, payload.new as Mission])
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "missions" },
        (payload) => {
          const updated = payload.new as Mission
          setMissions((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          )
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return missions
}

// ---------------------------------------------------------------------------
// useRealtimeSteps
// ---------------------------------------------------------------------------

export function useRealtimeSteps(
  missionId: string,
  initialSteps: Step[],
): Step[] {
  const [steps, setSteps] = useState(initialSteps)

  useEffect(() => {
    setSteps(initialSteps)
  }, [initialSteps])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel: RealtimeChannel = client
      .channel(`steps-realtime-${missionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "steps",
          filter: `mission_id=eq.${missionId}`,
        },
        (payload) => {
          setSteps((prev) => [...prev, payload.new as Step])
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "steps",
          filter: `mission_id=eq.${missionId}`,
        },
        (payload) => {
          const updated = payload.new as Step
          setSteps((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s)),
          )
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [missionId])

  return steps
}

// ---------------------------------------------------------------------------
// useRealtimeProjects
// ---------------------------------------------------------------------------

export function useRealtimeProjects(initialProjects: Project[]): Project[] {
  const [projects, setProjects] = useState(initialProjects)

  useEffect(() => {
    setProjects(initialProjects)
  }, [initialProjects])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channel: RealtimeChannel = client
      .channel("projects-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projects" },
        (payload) => {
          setProjects((prev) => [...prev, payload.new as Project])
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects" },
        (payload) => {
          const updated = payload.new as Project
          setProjects((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          )
        },
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [])

  return projects
}

// ---------------------------------------------------------------------------
// useRealtimeTasks
// ---------------------------------------------------------------------------

export function useRealtimeTasks(
  initialTasks: Task[],
  projectId?: string,
): Task[] {
  const [tasks, setTasks] = useState(initialTasks)

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    if (!REALTIME_ENABLED || !supabase) return

    const client = supabase
    const channelName = projectId
      ? `tasks-realtime-${projectId}`
      : "tasks-realtime-all"

    const filter = projectId
      ? { event: "*" as const, schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }
      : { event: "*" as const, schema: "public", table: "tasks" }

    const channel: RealtimeChannel = client
      .channel(channelName)
      .on("postgres_changes", filter, (payload) => {
        if (payload.eventType === "INSERT") {
          setTasks((prev) => [...prev, payload.new as Task])
        } else if (payload.eventType === "UPDATE") {
          const updated = payload.new as Task
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t)),
          )
        }
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [projectId])

  return tasks
}
