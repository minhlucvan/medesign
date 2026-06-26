import React from 'react';
import { Card, Heading, Eyebrow, Button, Badge } from '@ds';

interface Tier { name: string; price: string; cadence: string; features: string[]; featured?: boolean }

const TIERS: Tier[] = [
  { name: 'Starter', price: '$0', cadence: '/mo', features: ['1 entity', '2 seats', 'Standard ledger', 'Email support'] },
  { name: 'Growth', price: '$240', cadence: '/mo', features: ['10 entities', 'Unlimited seats', 'Multi-currency', 'Approvals & roles', 'Priority support'], featured: true },
  { name: 'Scale', price: 'Custom', cadence: '', features: ['Unlimited entities', 'SSO / SCIM', 'Audit & SOC2 export', 'Dedicated CSM'] },
];

/** Pricing — three tiers, one accent budget reserved for the featured tier's CTA + badge. */
export function PricingView() {
  return (
    <div className="bg-surface min-h-screen p-8 font-[var(--font-sans)] text-text">
      <div className="mx-auto flex flex-col gap-10" style={{ maxWidth: 'var(--container-max)' }}>
        <header className="flex flex-col gap-2">
          <Eyebrow>Pricing</Eyebrow>
          <Heading level={1}>Plans that scale with the books</Heading>
          <p className="text-text-muted max-w-xl">Flat, predictable pricing. Every plan includes the full Swiss ledger, tabular reporting, and the audit trail.</p>
        </header>

        <section className="grid grid-cols-3 gap-4 items-start">
          {TIERS.map((t) => (
            <Card key={t.name} className={`flex flex-col gap-5 ${t.featured ? 'ring-2 ring-accent' : ''}`}>
              <div className="flex items-center justify-between">
                <Eyebrow>{t.name}</Eyebrow>
                {t.featured && <Badge tone="accent">Most popular</Badge>}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-[var(--font-mono)] tabular-nums text-[40px] leading-none text-text">{t.price}</span>
                <span className="text-text-muted text-sm">{t.cadence}</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-text-muted">
                {t.features.map((f) => (
                  <li key={f} className="border-b border-border pb-2">{f}</li>
                ))}
              </ul>
              <Button variant={t.featured ? 'primary' : 'secondary'}>{t.price === 'Custom' ? 'Talk to sales' : 'Start free'}</Button>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
