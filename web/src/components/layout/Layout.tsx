import { useState, useEffect } from 'react';
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
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useBillingStore } from '@/stores/useBillingStore';
import { ProjectSwitcher } from './ProjectSwitcher';

const Sidebar = ({ collapsed, setCollapsed }: { collapsed: boolean, setCollapsed: (v: boolean) => void }) => {
    const location = useLocation();
    const { signOut } = useUserStore();

    const menuItems = [
        { icon: BarChart3, label: 'Dashboard', path: '/app' },
        { icon: MessageSquare, label: 'The Brain', path: '/app/chat' },
        { icon: LayoutGrid, label: 'Board', path: '/app/board' },
        { icon: ShieldAlert, label: 'Risks', path: '/app/risks' },
        { icon: Network, label: 'Architecture', path: '/app/architecture' },
        { icon: CreditCard, label: 'Billing', path: '/app/billing' },
        { icon: Settings, label: 'Settings', path: '/app/settings' },
    ];

    return (
        <motion.div
            initial={false}
            animate={{ width: collapsed ? 80 : 260 }}
            className="relative flex h-screen flex-col border-r border-black/5 bg-card/50 backdrop-blur-xl dark:border-white/5"
        >
            <div className={cn("flex h-16 items-center transition-all duration-300", collapsed ? "justify-center px-0" : "px-6")}>
                <Link to="/app">
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
                    onClick={() => signOut()}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                    <LogOut className={cn("h-5 w-5", !collapsed && "mr-3")} />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>

            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-black/5 bg-background shadow-sm dark:border-white/5"
            >
                {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
        </motion.div>
    );
};

const Layout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const { user } = useUserStore();
    const { fetchProjects, fetchJiraStatus, fetchNotionStatus } = useProjectStore();
    const { fetchBilling } = useBillingStore();

    useEffect(() => {
        if (user?.id) {
            // Only fetch projects and billing globally. 
            // Settings are handled by the UserStore's auth listener or the explicit settings page.
            fetchProjects(user.id);
            fetchJiraStatus(user.id);
            fetchNotionStatus(user.id);
            fetchBilling();
        }
    }, [user?.id, fetchProjects, fetchJiraStatus, fetchNotionStatus, fetchBilling]); // Depend on user.id specifically

    const location = useLocation();

    return (
        <div className="flex h-screen bg-background overflow-hidden" id="main-layout">
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto relative h-full">
                    {location.pathname === '/app' && (
                        <div className="absolute top-8 right-8 z-50">
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
        </div>
    );
};

export default Layout;
