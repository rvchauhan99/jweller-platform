import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react"
import { cn } from "@/lib/cn"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"
  size?: "sm" | "md"
}

export const Button = ({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  children,
  ...props
}: ButtonProps) => {
  const variants = {
    primary: "bg-primary text-on-primary hover:bg-primary/90",
    secondary: "bg-surface text-text border border-border hover:bg-surface-alt",
    ghost: "bg-transparent text-muted hover:bg-surface-alt hover:text-text",
    danger: "bg-danger text-white hover:bg-danger/90",
    accent: "bg-accent text-white hover:bg-accent/90",
  }
  const sizes = {
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3 text-sm gap-2",
  }
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text",
      "placeholder:text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
)

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
      className
    )}
    {...props}
  >
    {children}
  </select>
)

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text",
      "placeholder:text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
      className
    )}
    {...props}
  />
)

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1 block text-xs font-medium text-muted", className)} {...props} />
)

export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("rounded-lg border border-border bg-surface", className)}>{children}</div>
)

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
      {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
)

export const Table = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("overflow-x-auto", className)}>
    <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
  </div>
)

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th
    className={cn(
      "sticky top-0 border-b border-border bg-surface-alt px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted",
      className
    )}
  >
    {children}
  </th>
)

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("border-b border-border px-3 py-2.5 text-text align-middle", className)}>{children}</td>
)

export const Field = ({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  className?: string
}) => (
  <div className={className}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
)

export const Modal = ({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) => {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </Button>
        </div>
        <div className="space-y-3 p-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="px-3 py-8 text-center text-sm text-muted">{children}</p>
)

export const Badge = ({ children, color }: { children: ReactNode; color?: string }) => (
  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize" style={{ color }}>
    {children}
  </span>
)

export const Tabs = ({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) => (
  <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={value === t.id}
        tabIndex={0}
        className={cn(
          "px-3 py-2 text-sm font-medium transition-colors",
          value === t.id
            ? "border-b-2 border-accent text-text"
            : "text-muted hover:text-text"
        )}
        onClick={() => onChange(t.id)}
      >
        {t.label}
      </button>
    ))}
  </div>
)
