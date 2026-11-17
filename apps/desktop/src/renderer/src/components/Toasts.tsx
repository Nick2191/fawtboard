import { X } from 'lucide-react'
import type { Toast } from '../hooks/useToasts'

type Props = {
  toasts: Toast[]
  onDismiss(id: number): void
}

export default function Toasts({ toasts, onDismiss }: Props): React.JSX.Element {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-tone={toast.tone}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action?.run()
                onDismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
