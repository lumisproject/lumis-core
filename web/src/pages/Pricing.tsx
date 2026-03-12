import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUserStore } from "@/stores/useUserStore";
import { toast } from "@/components/ui/use-toast";
import { supabase, API_BASE } from "@/lib/supabase";

const tiers = [
  {
    name: "Free",
    id: "free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "For open-source & hobbyists.",
    features: ["1 Active Project", "50 Queries / mo", "1 GB Vector Storage", "Single-turn Reasoning"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    id: "pro",
    monthlyPrice: 14.90,
    yearlyPrice: 149.90,
    description: "For professional developers.",
    features: ["Up to 5 Projects", "500 Queries / mo", "10 GB Vector Storage", "Multi-turn Reasoning + CoT"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Team",
    id: "team",
    monthlyPrice: 49.9,
    yearlyPrice: 499.9,
    description: "For startups & agencies.",
    features: ["Unlimited Projects", "Unlimited Queries", "Unlimited Storage", "Multi-turn Reasoning + CoT"],
    cta: "Upgrade to Team",
    highlight: false,
  },
];

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const user = useUserStore((state) => state.user);

  const handleSubscribe = async (tierId: string) => {
    if (tierId === "free") return (window.location.href = "/dashboard");
    
    if (!user) {
      toast({ title: "Authentication required", description: "Please log in." });
      return (window.location.href = "/login?redirect=/pricing");
    }

    setLoadingTier(tierId);
    try {
      // Get the active session to grab the access token securely
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("Could not verify your active session. Please log in again.");
      }
      const response = await fetch(`${API_BASE}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`, 
        },
        body: JSON.stringify({ tier: tierId, interval: isYearly ? "yearly" : "monthly" }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }};

  return (
    <div className="min-h-screen bg-background text-foreground py-20 px-4 flex flex-col items-center">
      {/* Header */}
      <div className="text-center max-w-2xl mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          All tiers include full freedom of AI Models, Jira/Notion Auto-Sync, and the Risk Engine.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-3 mb-12 bg-secondary/50 p-1.5 rounded-full border border-border/50">
        <span className={`text-sm px-3 ${!isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          Monthly
        </span>
        <Switch checked={isYearly} onCheckedChange={setIsYearly} className="data-[state=checked]:bg-primary" />
        <span className={`text-sm px-3 flex items-center gap-1.5 ${isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          Yearly <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm font-semibold">-16%</span>
        </span>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative flex flex-col p-6 rounded-2xl transition-all duration-300 ${
              tier.highlight
                ? "bg-secondary/20 border-2 border-primary shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)] scale-100 md:scale-105 z-10"
                : "bg-card border border-border/50 hover:border-border"
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 h-4">{tier.description}</p>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">
                ${isYearly ? tier.yearlyPrice : tier.monthlyPrice}
              </span>
              <span className="text-sm text-muted-foreground">/{isYearly ? "yr" : "mo"}</span>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-center text-sm">
                  <Check className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={tier.highlight ? "default" : "outline"}
              className={`w-full rounded-xl h-11 ${tier.highlight ? "shadow-lg" : ""}`}
              onClick={() => handleSubscribe(tier.id)}
              disabled={loadingTier === tier.id}
            >
              {loadingTier === tier.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tier.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}