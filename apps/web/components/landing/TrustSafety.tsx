import { Section } from "./Section";

const BLOCKS = [
  { heading: "Secure payments", body: "Your card is never shared with creators. Report and block anytime.", icon: <LockIcon /> },
  { heading: "Reliable payouts", body: "Bank transfers on a regular schedule. Clear statements, no surprises.", icon: <BankIcon /> },
] as const;

export function TrustSafety() {
  return (
    <Section id="trust-safety" title="Trust & safety" aria-labelledby="trust-heading">
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        {BLOCKS.map(({ heading, body, icon }) => (
          <div
            key={heading}
            className="flex gap-4 rounded-premium-lg border border-border/80 bg-card p-5 shadow-premium-sm transition-shadow duration-fast hover:shadow-premium-md motion-reduce:transition-none sm:p-6"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80" aria-hidden>
              {icon}
            </span>
            <div>
              <h3 className="text-premium-h3 font-semibold text-foreground">{heading}</h3>
              <p className="mt-2 text-premium-body-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  );
}
