// app/global-error.tsx
'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ textAlign: 'center', gap: '16px', display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>
            {error.digest ?? 'critical error'}
          </p>
          <button
            onClick={reset}
            style={{
              fontSize: '12px',
              color: '#888',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            retry
          </button>
        </div>
      </body>
    </html>
  )
}
