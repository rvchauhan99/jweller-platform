import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from "react"
import { cn } from "@/lib/cn"

/* ─── Button ─────────────────────────────────────────────────────────────── */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"
  size?: "sm" | "md" | "lg"
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
    primary:
      "bg-primary text-on-primary hover:opacity-90 shadow-xs",
    secondary:
      "bg-surface text-text border border-border hover:bg-surface-alt hover:border-border-strong shadow-xs",
    ghost:
      "bg-transparent text-muted hover:bg-surface-alt hover:text-text",
    danger:
      "bg-danger text-white hover:opacity-90 shadow-xs",
    accent:
      "bg-accent text-white hover:opacity-90 shadow-xs",
  }
  const sizes = {
    sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded",
    md: "h-8 px-3 text-[12.5px] gap-2 rounded-md",
    lg: "h-10 px-4 text-sm gap-2 rounded-md",
  }
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ring-offset)]",
        "disabled:pointer-events-none disabled:opacity-40 select-none",
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

/* ─── Input ──────────────────────────────────────────────────────────────── */

export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      "h-8 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text",
      "placeholder:text-faint",
      "transition-colors duration-100",
      "hover:border-border-strong",
      "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--ring-offset)] focus:border-transparent",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-alt",
      className
    )}
    {...props}
  />
)

/* ─── Select ─────────────────────────────────────────────────────────────── */

export const Select = ({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "h-8 w-full rounded-md border border-border bg-surface px-3 text-[13px] text-text",
      "transition-colors duration-100 hover:border-border-strong",
      "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--ring-offset)] focus:border-transparent",
      "cursor-pointer",
      className
    )}
    {...props}
  >
    {children}
  </select>
)

/* ─── Textarea ───────────────────────────────────────────────────────────── */

export const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn(
      "min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-text",
      "placeholder:text-faint resize-y",
      "transition-colors duration-100 hover:border-border-strong",
      "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 focus:ring-offset-[var(--ring-offset)] focus:border-transparent",
      className
    )}
    {...props}
  />
)

/* ─── Label ──────────────────────────────────────────────────────────────── */

export const Label = ({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("mb-1.5 block text-[11px] font-medium text-muted uppercase tracking-wide", className)}
    {...props}
  />
)

/* ─── Field ──────────────────────────────────────────────────────────────── */

export const Field = ({
  label,
  htmlFor,
  children,
  hint,
  className,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
  hint?: string
  className?: string
}) => (
  <div className={className}>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint ? (
      <p className="mt-1 text-[11px] text-faint">{hint}</p>
    ) : null}
  </div>
)

/* ─── Panel ──────────────────────────────────────────────────────────────── */

export const Panel = ({
  className,
  children,
  style,
}: {
  className?: string
  children: ReactNode
  style?: React.CSSProperties
}) => (
  <div
    className={cn(
      "rounded-lg border border-border bg-surface shadow-xs",
      className
    )}
    style={style}
  >
    {children}
  </div>
)

/* ─── PageHeader ─────────────────────────────────────────────────────────── */

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export const PageHeader = ({ title, subtitle, actions }: PageHeaderProps) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-[17px] font-semibold tracking-tight text-text leading-snug">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    ) : null}
  </div>
)

/* ─── Table ──────────────────────────────────────────────────────────────── */

export const Table = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div className={cn("overflow-x-auto", className)}>
    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
      {children}
    </table>
  </div>
)

export const Th = ({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) => (
  <th
    className={cn(
      "sticky top-0 z-10 border-b border-border bg-surface-alt px-4 py-2.5",
      "text-[10.5px] font-semibold uppercase tracking-wider text-muted",
      "whitespace-nowrap",
      className
    )}
    {...props}
  >
    {children}
  </th>
)

export const Td = ({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) => (
  <td
    className={cn(
      "border-b border-border px-4 py-3 text-text align-middle",
      "transition-colors duration-75",
      className
    )}
    {...props}
  >
    {children}
  </td>
)

/* ─── Badge ──────────────────────────────────────────────────────────────── */

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted"
  | "accent"

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: "bg-surface-alt text-muted border-border",
  success: "bg-success-soft text-success border-[color:var(--success)] border-opacity-20",
  warning: "bg-warning-soft text-warning border-[color:var(--warning)] border-opacity-20",
  danger:  "bg-danger-soft  text-danger  border-[color:var(--danger)]  border-opacity-20",
  info:    "bg-info-soft    text-info    border-[color:var(--info)]    border-opacity-20",
  muted:   "bg-surface-alt text-muted   border-border",
  accent:  "bg-accent-soft  text-accent-text border-[color:var(--accent)] border-opacity-20",
}

/** Semantic status → badge variant mapping */
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  reserved:  "warning",
  placed:    "warning",
  confirmed: "accent",
  packed:    "info",
  shipped:   "info",
  delivered: "success",
  cancelled: "danger",
  returned:  "danger",
  active:    "success",
  paused:    "warning",
  missed:    "danger",
  due:       "warning",
  paid:      "success",
}

export const Badge = ({
  children,
  variant,
  status,
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  /** Convenience: auto-resolve from order/SIP status string */
  status?: string
  className?: string
}) => {
  const resolved: BadgeVariant =
    variant ?? (status ? STATUS_VARIANT[status] ?? "default" : "default")
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5",
        "text-[10.5px] font-semibold capitalize border",
        "whitespace-nowrap",
        BADGE_VARIANTS[resolved],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ─── StatusDot ──────────────────────────────────────────────────────────── */

export const StatusDot = ({
  variant = "default",
  className,
}: {
  variant?: BadgeVariant
  className?: string
}) => {
  const colors: Record<BadgeVariant, string> = {
    default: "bg-faint",
    success: "bg-success",
    warning: "bg-warning",
    danger:  "bg-danger",
    info:    "bg-info",
    muted:   "bg-muted",
    accent:  "bg-accent",
  }
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        colors[variant],
        className
      )}
    />
  )
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */

export const Modal = ({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg"
}) => {
  if (!open) return null
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0% 0 0 / 0.5)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl",
          widths[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-muted",
              "hover:bg-surface-alt hover:text-text transition-colors text-[16px] leading-none"
            )}
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ─── Empty ──────────────────────────────────────────────────────────────── */

export const Empty = ({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}) => (
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
    {icon ? (
      <div className="mb-3 text-faint">{icon}</div>
    ) : null}
    {title ? (
      <p className="text-[13px] font-medium text-text">{title}</p>
    ) : null}
    {description ? (
      <p className="mt-1 text-[12px] text-muted">{description}</p>
    ) : null}
    {children ? (
      <p className="text-[12px] text-muted">{children}</p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

/* ─── Tabs ───────────────────────────────────────────────────────────────── */

export const Tabs = ({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  value: string
  onChange: (id: string) => void
}) => (
  <div
    className="mb-5 flex gap-0.5 border-b border-border"
    role="tablist"
  >
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={value === t.id}
        tabIndex={0}
        className={cn(
          "relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] font-medium transition-colors",
          value === t.id
            ? "text-text after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-accent after:rounded-full"
            : "text-muted hover:text-text"
        )}
        onClick={() => onChange(t.id)}
      >
        {t.label}
        {t.count != null ? (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              value === t.id
                ? "bg-accent-soft text-accent-text"
                : "bg-surface-alt text-muted"
            )}
          >
            {t.count}
          </span>
        ) : null}
      </button>
    ))}
  </div>
)

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

export const Skeleton = ({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) => <div className={cn("skeleton", className)} style={style} />

export const SkeletonRows = ({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r}>
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c} className="border-b border-border px-4 py-3">
            <Skeleton className={cn("h-4 rounded", c === 0 ? "w-24" : "w-16")} />
          </td>
        ))}
      </tr>
    ))}
  </>
)

/* ─── Stat ───────────────────────────────────────────────────────────────── */

/** A compact label + value row — NOT a big metric card */
export const Stat = ({
  label,
  value,
  meta,
  variant,
}: {
  label: string
  value: ReactNode
  meta?: ReactNode
  variant?: "default" | "success" | "warning" | "danger"
}) => {
  const valueColor = {
    default: "text-text",
    success: "text-success",
    warning: "text-warning",
    danger:  "text-danger",
  }[variant ?? "default"]

  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12px] text-muted shrink-0">{label}</span>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={cn("text-[13px] font-semibold tabular-nums", valueColor)}>
          {value}
        </span>
        {meta ? (
          <span className="text-[11px] text-muted truncate">{meta}</span>
        ) : null}
      </div>
    </div>
  )
}

/* ─── SectionHeading ─────────────────────────────────────────────────────── */

export const SectionHeading = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <h2
    className={cn(
      "mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted",
      className
    )}
  >
    {children}
  </h2>
)

/* ─── Divider ────────────────────────────────────────────────────────────── */

export const Divider = ({ className }: { className?: string }) => (
  <hr className={cn("border-border my-4", className)} />
)

/* ─── AlertBar ───────────────────────────────────────────────────────────── */

export const AlertBar = ({
  children,
  variant = "warning",
  onDismiss,
  className,
}: {
  children: ReactNode
  variant?: "info" | "warning" | "danger" | "success"
  onDismiss?: () => void
  className?: string
}) => {
  const styles = {
    info:    "bg-info-soft text-info border-[color:var(--info)]",
    warning: "bg-warning-soft text-warning border-[color:var(--warning)]",
    danger:  "bg-danger-soft text-danger border-[color:var(--danger)]",
    success: "bg-success-soft text-success border-[color:var(--success)]",
  }
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-[12.5px] font-medium",
        styles[variant],
        className
      )}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-[16px] leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  )
}
