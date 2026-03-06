"use client";

import { useState, useEffect } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { EventFeed } from "@/components/event-feed";
import { getEvents } from "@/lib/queries";
import type { Event } from "@/lib/types";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    getEvents(100).then(setEvents);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <div className="flex-1 overflow-y-auto">
        <EventFeed events={events} />
      </div>
    </div>
  );
}
