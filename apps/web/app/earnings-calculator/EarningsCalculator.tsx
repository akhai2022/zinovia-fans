"use client";

import { useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function EarningsCalculator() {
  const [subscribers, setSubscribers] = useState(500);
  const [subPrice, setSubPrice] = useState(9.99);
  const [unlocksPerSub, setUnlocksPerSub] = useState(0.5);
  const [unlockPrice, setUnlockPrice] = useState(5);

  const monthlyGross =
    subscribers * subPrice + subscribers * unlocksPerSub * unlockPrice;

  const zinoviaNet = monthlyGross * (1 - 0.15);
  const onlyfansNet = monthlyGross * (1 - 0.2);
  const patreonNet = monthlyGross * (1 - 0.13);
  const fanslyNet = monthlyGross * (1 - 0.2);

  const annualDiff = (zinoviaNet - onlyfansNet) * 12;

  return (
    <section className="space-y-8">
      <div className="rounded-2xl border border-white/[0.06] bg-card p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-foreground mb-6">
          Adjust your numbers
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Subscribers */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="subscribers">
              Number of subscribers
            </label>
            <input
              id="subscribers"
              type="number"
              min={10}
              max={50000}
              value={subscribers}
              onChange={(e) => setSubscribers(Math.max(10, Math.min(50000, Number(e.target.value) || 10)))}
              className="w-full rounded-xl border border-white/[0.06] bg-card px-4 py-3 text-foreground"
            />
            <input
              type="range"
              min={10}
              max={50000}
              step={10}
              value={subscribers}
              onChange={(e) => setSubscribers(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Subscriber count slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10</span>
              <span>50,000</span>
            </div>
          </div>

          {/* Subscription Price */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="subPrice">
              Monthly subscription price (EUR)
            </label>
            <input
              id="subPrice"
              type="number"
              min={1}
              max={100}
              step={0.01}
              value={subPrice}
              onChange={(e) => setSubPrice(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/[0.06] bg-card px-4 py-3 text-foreground"
            />
          </div>

          {/* Paid unlocks per subscriber */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="unlocksPerSub">
              Avg. paid unlocks per subscriber / month
            </label>
            <input
              id="unlocksPerSub"
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={unlocksPerSub}
              onChange={(e) => setUnlocksPerSub(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/[0.06] bg-card px-4 py-3 text-foreground"
            />
          </div>

          {/* Unlock Price */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="unlockPrice">
              Average unlock price (EUR)
            </label>
            <input
              id="unlockPrice"
              type="number"
              min={1}
              max={200}
              step={0.5}
              value={unlockPrice}
              onChange={(e) => setUnlockPrice(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/[0.06] bg-card px-4 py-3 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Gross */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">Monthly Gross Revenue</p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{fmt(monthlyGross)}</p>
        </div>

        {/* Zinovia */}
        <div className="rounded-2xl border-2 border-primary/50 bg-card p-6 text-center">
          <p className="text-xs font-medium text-primary">Zinovia Net (15% fee)</p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{fmt(zinoviaNet)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payout in 48 hours</p>
        </div>

        {/* OnlyFans */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">OnlyFans Net (20% fee)</p>
          <p className="mt-2 font-display text-2xl font-bold text-muted-foreground">{fmt(onlyfansNet)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payout in 21 days</p>
        </div>

        {/* Patreon */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">Patreon Net (~13% total)</p>
          <p className="mt-2 font-display text-2xl font-bold text-muted-foreground">{fmt(patreonNet)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payout in 30+ days</p>
        </div>

        {/* Fansly */}
        <div className="rounded-2xl border border-white/[0.06] bg-card p-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">Fansly Net (20% fee)</p>
          <p className="mt-2 font-display text-2xl font-bold text-muted-foreground">{fmt(fanslyNet)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payout in 7 days</p>
        </div>

        {/* Annual Difference */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <p className="text-xs font-medium text-primary">Annual Difference vs OnlyFans</p>
          <p className="mt-2 font-display text-2xl font-bold text-gradient-brand">
            +{fmt(annualDiff)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">More in your pocket with Zinovia</p>
        </div>
      </div>
    </section>
  );
}
