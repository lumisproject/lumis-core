import { useEffect, useState } from 'react';

import { motion } from 'framer-motion';
import {
    Check,
    X,
    CreditCard,
    Zap,
    Layers,
    ArrowRight
} from 'lucide-react';

import { useBillingStore } from '@/stores/useBillingStore';
import { cn } from '@/lib/utils';
import { API_BASE, supabase } from '@/lib/supabase';

const PricingCard = ({ tier, price, description, features, active, highlight, interval }: any) => {
    const handleCheckout = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // If active plan, go to portal. If upgrading, go to checkout.
            const endpoint = active
                ? `${API_BASE}/api/billing/create-portal-session`
                : `${API_BASE}/api/billing/create-checkout-session`;

            const payload = active ? {} : { tier: tier.toLowerCase(), interval };


            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const { url } = await res.json();
                window.location.href = url; // Redirects the user to Stripe
            }
        } catch (error) {
            console.error("Billing error:", error);
        }
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={cn(
                "relative flex flex-col rounded-3xl p-8 transition-all",
                highlight
                    ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/20 scale-105 z-10"
                    : "bg-card border border-black/5 dark:border-white/5"
            )}
        >
            {active && (
                <div className={cn(
                    "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-xl border",
                    highlight
                        ? "bg-white text-black border-black/10"
                        : "bg-primary text-primary-foreground border-white/10"
                )}>
                    Current Plan
                </div>
            )}

            <div className="mb-8 relative z-10">
                <h3 className="text-xl font-black tracking-tight">{tier}</h3>
                <div className="mt-4 flex flex-col">
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tracking-tighter">${price}</span>
                        <span className={cn("text-xs font-bold uppercase tracking-widest opacity-70", highlight ? "text-primary-foreground" : "text-muted-foreground")}>
                            /month
                        </span>
                    </div>
                    {interval === 'yearly' && tier !== 'Free' && (
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60", highlight ? "text-primary-foreground" : "text-primary")}>
                            Billed annually
                        </span>
                    )}
                </div>


                <p className={cn("mt-4 text-sm font-medium leading-relaxed", highlight ? "text-primary-foreground/90 font-bold" : "text-muted-foreground")}>
                    {description}
                </p>
            </div>

            <div className="mb-8 flex-1 space-y-4 relative z-10">
                {features.map((feature: string, i: number) => {
                    const isDisabled = feature.includes('Disabled');
                    const Icon = isDisabled ? X : Check;
                    
                    return (
                        <div key={i} className="flex items-center gap-3">
                            <div className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full shrink-0", 
                                isDisabled 
                                    ? (highlight ? "bg-white/10" : "bg-destructive/10")
                                    : (highlight ? "bg-green-400/20" : "bg-green-500/10")
                            )}>
                                <Icon className={cn(
                                    "h-3 w-3", 
                                    isDisabled 
                                        ? (highlight ? "text-white/70" : "text-destructive") 
                                        : (highlight ? "text-green-300" : "text-green-500")
                                )} />
                            </div>


                            <span className={cn(
                                "text-sm font-medium", 
                                highlight ? "text-primary-foreground font-semibold" : (isDisabled ? "text-muted-foreground line-through opacity-50" : "text-foreground/80")
                            )}>
                                {feature}
                            </span>
                        </div>
                    );
                })}
            </div>

            {active && tier === 'Free' ? (
                <div className="flex h-12 w-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-accent/30 rounded-xl border border-black/5 dark:border-white/5 opacity-50">
                    Free Plan Active
                </div>
            ) : (
                <button
                    onClick={handleCheckout}
                    className={cn(
                        "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg",
                        highlight
                            ? "bg-white text-black hover:bg-white/90 shadow-white/20 border border-black"
                            : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                    )}>
                    {active ? "Manage Subscription" : "Upgrade Now"}
                    {!active && <ArrowRight className={cn("h-4 w-4", highlight ? "text-black" : "text-primary")} />}
                </button>
            )}
        </motion.div>
    );
};

const Billing = () => {
    const { tier, limits, usage, fetchBilling } = useBillingStore();
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        fetchBilling();
    }, []);

    const premiumPrice = billingInterval === 'monthly' ? "14.9" : "11.9";


    return (
        <div className="space-y-12 pb-20 p-8">
            <div className="text-center">
                <h1 className="text-4xl font-black tracking-tight">Billing & Plans</h1>
                <p className="mt-2 text-muted-foreground">Manage your subscription and project limits.</p>
                
                {/* Billing Toggle */}
                <div className="mt-10 flex items-center justify-center gap-4">
                    <span className={cn("text-sm font-bold tracking-tight", billingInterval === 'monthly' ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
                    <button 
                        onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
                        className="relative h-7 w-14 rounded-full bg-accent p-1 transition-colors hover:bg-accent/80"
                    >
                        <motion.div 
                            animate={{ x: billingInterval === 'monthly' ? 0 : 28 }}
                            className="h-5 w-5 rounded-full bg-primary shadow-lg"
                        />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-bold tracking-tight", billingInterval === 'yearly' ? "text-foreground" : "text-muted-foreground")}>Yearly</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/20">
                            Save 20%
                        </span>
                    </div>
                </div>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
                <PricingCard
                    tier="Free"
                    price="0"
                    interval={billingInterval}
                    description="Essential features for individual explorers."
                    active={tier === 'free'}
                    highlight={false}
                    features={[
                        "3 Projects",
                        "50 Queries / month",
                        "1 GB Storage",
                        "Email Support",
                        "Chat forgets context between sessions (Disabled)",
                        "Basic analysis only (Reasoning Disabled)"
                    ]}
                />
                <PricingCard
                    tier="Premium"
                    price={premiumPrice}
                    interval={billingInterval}
                    description="Unlimit your potential with full AI capabilities."
                    active={tier === 'premium'}
                    highlight={true}
                    features={[
                        "Unlimited Projects",
                        "Unlimited Queries",
                        "Unlimited Storage",
                        "Priority Support",
                        "Multi-turn Memory Enabled",
                        "LLM Reasoning Enabled"
                    ]}
                />
            </div>



            <div className="mt-20 space-y-8">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <Layers className="h-6 w-6 text-primary" />
                    Usage Overview
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <UsageWidget
                        label="Monthly Queries"
                        current={usage.query_count}
                        max={limits.queries}
                        icon={Zap}
                    />
                    <UsageWidget
                        label="Active Projects"
                        current={usage.project_count}
                        max={limits.projects}
                        icon={CreditCard}
                    />
                </div>
            </div>
        </div>
    );
};

const UsageWidget = ({ label, current, max, icon: Icon }: any) => {
    const percentage = Math.min((current / max) * 100, 100);
    return (
        <div className="rounded-3xl border border-black/5 bg-card/60 p-8 dark:border-white/5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-bold tracking-tight text-foreground">{label}</span>
                </div>
                <span className="text-sm font-mono text-muted-foreground">
                    {current} / <span className="font-bold text-foreground">{max}</span>
                </span>
            </div>
            <div className="h-2 w-full rounded-full bg-accent overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    className={cn(
                        "h-full rounded-full transition-all",
                        percentage > 90 ? "bg-destructive" : percentage > 70 ? "bg-orange-500" : "bg-primary"
                    )}
                />
            </div>
        </div>
    );
};

export default Billing;
