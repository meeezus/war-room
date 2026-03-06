"use client";

import { SidebarNav } from "@/components/sidebar-nav";
import { LogViewer } from "@/components/log-viewer";

export default function LogsPage() {
  return (
    <div className="flex h-screen bg-background">
      <SidebarNav />
      <main className="flex flex-1 flex-col overflow-hidden">
        <LogViewer />
      </main>
    </div>
  );
}
