import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Check,
    CreditCard,
    Zap,
    Layers,
    ArrowRight
} from 'lucide-react';
import { useBillingStore } from '@/stores/useBillingStore';
import { cn } from '@/lib/utils';

const PricingCard = ({ tier, price, description, features, active, highlight }: any) => (
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
                "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                highlight ? "bg-white text-primary" : "bg-primary text-primary-foreground"
            )}>
                Current Plan
            </div>
        )}

        <div className="mb-8">
            <h3 className="text-xl font-black tracking-tight">{tier}</h3>
            <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tighter">${price}</span>
                <span className={cn("text-xs font-bold uppercase tracking-widest", highlight ? "text-primary-foreground/70" : "text-muted-foreground")}>/month</span>
            </div>
            <p className={cn("mt-4 text-sm font-medium", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {description}
            </p>
        </div>

        <div className="mb-8 flex-1 space-y-4">
            {features.map((feature: string, i: number) => (
                <div key={i} className="flex items-center gap-3">
                    <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", highlight ? "bg-white/20" : "bg-primary/10")}>
                        <Check className={cn("h-3 w-3", highlight ? "text-white" : "text-primary")} />
                    </div>
                    <span className="text-sm font-medium">{feature}</span>
                </div>
            ))}
        </div>

        <button className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
            highlight
                ? "bg-white text-primary hover:bg-white/90"
                : "bg-accent hover:bg-accent/80"
        )}>
            {active ? "Managed Subscription" : "Upgrade Now"}
            {!active && <ArrowRight className="h-4 w-4" />}
        </button>
    </motion.div>
);

const Billing = () => {
    const { tier, limits, usage, fetchBilling } = useBillingStore();

    useEffect(() => {
        fetchBilling();
    }, []);

    return (
        <div className="space-y-12 pb-20">
            <div className="text-center">
                <h1 className="text-4xl font-black tracking-tight">Billing & Plans</h1>
                <p className="mt-2 text-muted-foreground">Manage your subscription and project limits.</p>
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
                <PricingCard
                    tier="Free"
                    price="0"
                    description="Perfect for individuals exploring Lumis."
                    active={tier === 'free'}
                    highlight={tier === 'free'}
                    features={[
                        "1 Project",
                        "50 Queries / mo",
                        "Standard Speed",
                        "Email Support"
                    ]}
                />
                <PricingCard
                    tier="Pro"
                    price="29"
                    description="For power users and solo developers."
                    active={tier === 'pro'}
                    highlight={tier === 'pro'}
                    features={[
                        "10 Projects",
                        "Unlimited Queries",
                        "GPT-4o Reasoning",
                        "Webhooks & API",
                        "Priority Support"
                    ]}
                />
                <PricingCard
                    tier="Team"
                    price="99"
                    description="Scale your entire engineering team."
                    active={tier === 'team'}
                    highlight={tier === 'team'}
                    features={[
                        "Unlimited Projects",
                        "Collaborative Chat",
                        "Custom Constraints",
                        "SSO & Security",
                        "Dedicated Manager"
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
        <div className="rounded-3xl border border-black/5 bg-card p-8 dark:border-white/5">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-bold">{label}</span>
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
