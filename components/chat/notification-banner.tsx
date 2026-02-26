"use client"

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

interface NotificationBannerProps {
  onRequestPermission: () => Promise<boolean>
}

export function NotificationBanner({ onRequestPermission }: NotificationBannerProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('notification-banner-dismissed')
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied'

    if (!dismissed && !granted && !denied && typeof Notification !== 'undefined') {
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleEnable = async () => {
    setLoading(true)
    const success = await onRequestPermission()
    setLoading(false)
    if (success) setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('notification-banner-dismissed', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <Bell className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">Get notified when agents respond</span>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="px-3 py-1 text-xs font-medium rounded-md bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Enable'}
      </button>
      <button onClick={handleDismiss} className="p-1 text-muted-foreground/50 hover:text-muted-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
