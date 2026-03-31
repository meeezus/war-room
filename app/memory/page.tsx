"use client"

import { SidebarNav } from '@/components/sidebar-nav'
import { MemoryBrowser } from '@/components/memory-browser'

export default function MemoryPage() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <SidebarNav />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 pt-14 sm:p-6 md:p-10 lg:pt-10">

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold text-foreground">
              System Memory
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Skill patches, agent discoveries, and authority domains
            </p>
          </div>

          <MemoryBrowser />
        </div>
      </main>
    </div>
  )
}
