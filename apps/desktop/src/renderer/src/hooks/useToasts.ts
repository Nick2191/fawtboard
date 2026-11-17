import { useCallback, useRef, useState } from 'react'

export type Toast = {
  id: number
  message: string
  tone?: 'error'
  action?: { label: string; run(): void }
}

const LIFETIME_MS = 6000

export function useToasts(): {
  toasts: Toast[]
  notify(toast: Omit<Toast, 'id'>): void
  dismiss(id: number): void
} {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      // Three is plenty; older ones are stale by the time a fourth arrives.
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      setTimeout(() => dismiss(id), LIFETIME_MS)
    },
    [dismiss]
  )

  return { toasts, notify, dismiss }
}
