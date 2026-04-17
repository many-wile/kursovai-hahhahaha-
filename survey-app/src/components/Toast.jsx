import { useToast } from '../contexts/ToastContext.jsx'

export default function Toasts() {
  const { toasts } = useToast()
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.text}
        </div>
      ))}
    </div>
  )
}