"use client";

import { useEffect, useState, useTransition } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

type BillingPlan = {
  key: "free" | "pro" | "enterprise";
  name: string;
  description: string;
  monthlyPriceCents: number;
  includedTokens: number;
  features: string[];
};

type BillingOverview = {
  configured: boolean;
  plan: BillingPlan;
  plans: BillingPlan[];
  subscription: {
    status: string;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    tokensUsed: number;
    includedTokens: number;
    billableTokens: number;
    estimatedTokenOverageCents: number;
  };
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function BillingSettings() {
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    fetch("/api/billing")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load billing.");
        }
        return response.json() as Promise<{ billing: BillingOverview }>;
      })
      .then((payload) => {
        if (active) {
          setBilling(payload.billing);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load billing.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function openCheckout(plan: "pro" | "enterprise") {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.json()) as { url?: string; message?: string };

      if (!response.ok || !payload.url) {
        setError(payload.message ?? "Unable to start checkout.");
        return;
      }

      window.location.assign(payload.url);
    });
  }

  function openPortal() {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string; message?: string };

      if (!response.ok || !payload.url) {
        setError(payload.message ?? "Unable to open billing portal.");
        return;
      }

      window.location.assign(payload.url);
    });
  }

  if (!billing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {error ?? "Loading billing workspace..."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Billing</CardTitle>
        <Badge variant="outline">{billing.plan.name}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-xs">Monthly plan</p>
            <p className="font-medium">{money(billing.plan.monthlyPriceCents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tokens used</p>
            <p className="font-medium">
              {number(billing.usage.tokensUsed)} / {number(billing.usage.includedTokens)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Estimated overage</p>
            <p className="font-medium">{money(billing.usage.estimatedTokenOverageCents)}</p>
          </div>
        </div>

        {billing.subscription ? (
          <div className="border-border rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Subscription status</span>
              <Badge>{billing.subscription.status}</Badge>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending || !billing.configured} onClick={() => openCheckout("pro")}>
            <CreditCard />
            Upgrade to Pro
          </Button>
          <Button
            disabled={isPending || !billing.configured}
            onClick={() => openCheckout("enterprise")}
            variant="outline"
          >
            Enterprise
          </Button>
          <Button disabled={isPending || !billing.configured} onClick={openPortal} variant="ghost">
            <ExternalLink />
            Manage billing
          </Button>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
