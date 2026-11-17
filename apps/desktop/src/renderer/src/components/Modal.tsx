import { useEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'

type Props = {
  /** Owned by the caller so its own buttons can call `close()`. */
  dialogRef: RefObject<HTMLDialogElement | null>
  className: string
  labelledBy: string
  style?: CSSProperties
  /** Fires however the dialog closes: Esc, the backdrop, or `close()`. */
  onClose(): void
  children: ReactNode
}

/** A native modal dialog that opens on mount and closes on Esc or a backdrop press. */
export default function Modal(props: Props): React.JSX.Element {
  const { dialogRef } = props

  useEffect(() => {
    // Guarded because StrictMode runs effects twice and showModal() throws on an open dialog.
    if (!dialogRef.current?.open) dialogRef.current?.showModal()
  }, [dialogRef])

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${props.className}`}
      aria-labelledby={props.labelledBy}
      style={props.style}
      onClose={props.onClose}
      // mousedown, not click: a text selection that ends on the backdrop must not close the dialog.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
    >
      {props.children}
    </dialog>
  )
}
