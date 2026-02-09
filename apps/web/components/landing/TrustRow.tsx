import { Section } from "./Section";

const TRUST_ITEMS: { label: string; icon: React.ReactNode }[] = [
  { label: "Secure payments", icon: <LockIcon /> },
  { label: "Payouts on schedule", icon: <CalendarIcon /> },
  { label: "Cancel anytime", icon: <CancelIcon /> },
  { label: "Transparent fees", icon: <ReceiptIcon /> },
  { label: "Your content, your rules", icon: <ShieldIcon /> },
];

export function TrustRow() {
  return (
    <Section tone="surface" aria-label="Trust and reliability">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-12">
        {TRUST_ITEMS.map(({ label, icon }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 text-premium-body-sm text-muted-foreground"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border/80 text-foreground/80 shadow-soft"
              aria-hidden
            >
              {icon}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function CancelIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function ReceiptIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
