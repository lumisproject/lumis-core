import { useState, useEffect } from 'react';
// LUMIS_GLOBAL_NOTIFICATION_ACTIVE
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    MessageSquare,
    Settings,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    ShieldAlert,
    Network,
    LogOut,
    Menu,
    Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: { collapsed: boolean, setCollapsed: (v: boolean) => void, mobileOpen: boolean, setMobileOpen: (v: boolean) => void }) => {
    const location = useLocation();
    const { signOut } = useUserStore();

    const menuItems = [
        { icon: BarChart3, label: 'Dashboard', path: '/app' },
        { icon: MessageSquare, label: 'The Brain', path: '/app/chat' },
        { icon: ShieldAlert, label: 'Risks', path: '/app/risks' },
        { icon: Network, label: 'Architecture', path: '/app/architecture' },
        { icon: Mail, label: 'Email Drafts', path: '/app/drafts' },
        { icon: LayoutGrid, label: 'Board', path: '/app/board' },
        { icon: CreditCard, label: 'Billing', path: '/app/billing' },
        { icon: Settings, label: 'Settings', path: '/app/settings' },
    ];

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setMobileOpen(false)}
                        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={false}
                animate={{ 
                    width: collapsed ? 80 : 260,
                    x: mobileOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 768 ? -260 : 0)
                }}
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-black/5 bg-card/50 backdrop-blur-xl dark:border-white/5 transition-transform duration-300 md:relative md:translate-x-0 md:transition-none",
                    !mobileOpen && "-translate-x-full md:translate-x-0"
                )}
            >
                <div className={cn("flex h-16 items-center transition-all duration-300", collapsed ? "justify-center px-0" : "px-6")}>
                    <Link to="/app" onClick={() => setMobileOpen(false)}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={collapsed ? 'icon' : 'wordmark'}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-center gap-3"
                            >
                                {collapsed ? (
                                    <>
                                        <img src="/black-menu.svg" alt="Lumis Icon" className="h-8 w-8 dark:hidden" />
                                        <img src="/white-menu.svg" alt="Lumis Icon" className="h-8 w-8 hidden dark:block" />
                                    </>
                                ) : (
                                    <>
                                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-6 w-auto block dark:hidden" />
                                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-6 w-auto hidden dark:block" />
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </Link>
                </div>

                <nav className="flex-1 space-y-1 px-3 py-4">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                            >
                                <item.icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                                {!collapsed && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                                {isActive && !collapsed && (
                                    <motion.div
                                        layoutId="active-indicator"
                                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground"
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto border-t border-black/5 p-4 dark:border-white/5">
                    <button
                        onClick={() => {
                            setMobileOpen(false);
                            signOut();
                        }}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                        <LogOut className={cn("h-5 w-5", !collapsed && "mr-3")} />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </div>

                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-black/5 bg-background shadow-sm dark:border-white/5 md:flex"
                >
                    {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                </button>
            </motion.div>
        </>
    );
};

const Layout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user } = useUserStore();
    const { fetchProjects, fetchJiraStatus, fetchNotionStatus, project } = useProjectStore();
    const { fetchBilling } = useBillingStore();
    const [draftNotification, setDraftNotification] = useState<{ id: string; title: string } | null>(null);

    useEffect(() => {
        if (user?.id) {
            fetchProjects(user.id);
            fetchJiraStatus(user.id);
            fetchNotionStatus(user.id);
            fetchBilling();
        }
    }, [user?.id, fetchProjects, fetchJiraStatus, fetchNotionStatus, fetchBilling]);

    // Global Draft Notification Listener
    useEffect(() => {
        if (!project?.id) return;

        const channel = supabase
            .channel('global-draft-updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'draft_tickets',
                    filter: `project_id=eq.${project.id}`
                },
                (payload) => {
                    const newDraft = payload.new as any;
                    setDraftNotification({ id: newDraft.id, title: newDraft.title });
                    setTimeout(() => setDraftNotification(null), 6000); // Auto-hide after 6s
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [project?.id]);
    

    const location = useLocation();

    return (
        <div className="flex h-screen bg-background overflow-hidden" id="main-layout">
            <Sidebar 
                collapsed={collapsed} 
                setCollapsed={setCollapsed} 
                mobileOpen={mobileOpen} 
                setMobileOpen={setMobileOpen} 
            />
            
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Mobile Top Bar */}
                <header className="flex h-16 items-center justify-between border-b border-black/5 px-4 bg-card/30 backdrop-blur-xl dark:border-white/5 md:hidden">
                    <Link to="/app">
                        <img src="/lumis-black.svg" alt="Lumis Logo" className="h-5 w-auto block dark:hidden" />
                        <img src="/lumis-white.svg" alt="Lumis Logo" className="h-5 w-auto hidden dark:block" />
                    </Link>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto relative h-full">
                    {location.pathname === '/app' && (
                        <div className="absolute top-4 right-4 md:top-8 md:right-8 z-30">
                            <ProjectSwitcher />
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={window.location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="w-full h-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            {/* Global Draft Notification Toast */}
            <AnimatePresence>
                {draftNotification && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, x: '-50%', scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        className="fixed bottom-12 left-1/2 z-[100] w-full max-w-md px-4"
                    >
                        <div 
                            onClick={() => {
                                setDraftNotification(null);
                                window.location.href = '/app/drafts'; // Navigate to drafts when clicked
                            }}
                            className="bg-[#1A1A1A]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-5 group cursor-pointer hover:border-orange-500/50 transition-colors"
                        >
                            <div className="h-14 w-14 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/20 flex-shrink-0 relative overflow-hidden">
                                <Sparkles className="h-6 w-6 text-orange-500 relative z-10" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-transparent animate-pulse" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Neural Sync Ready</span>
                                    <div className="h-1 w-1 rounded-full bg-orange-500 animate-ping" />
                                </div>
                                <h4 className="text-sm font-bold text-white truncate leading-tight">
                                    {draftNotification.title}
                                </h4>
                                <p className="text-[10px] font-medium text-white/40 mt-1">
                                    A new draft has been synthesized. Click to view.
                                </p>
                            </div>

                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setDraftNotification(null); 
                                }}
                                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors group/close"
                            >
                                <X className="h-4 w-4 text-white/20 group-hover/close:text-white transition-colors" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Layout;
