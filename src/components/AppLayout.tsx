import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, useCycle } from 'framer-motion';
import { QuickAdd } from '@/components/QuickAdd';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ViewModeBanner } from '@/components/ViewModeBanner';
import { ExternalViewBanner, ExternalViewBannerSpacer } from '@/components/ExternalViewBanner';
import { ExternalViewToggle } from '@/components/ExternalViewToggle';
import { NotificationBell } from '@/components/NotificationBell';
import { EmailIcon } from '@/components/EmailIcon';
import { CalendarIcon } from '@/components/CalendarIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Activity,
  FileText,
  LineChart,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  Plus,
  UserCog,
  UserX,
  Kanban,
  PanelLeft,
  Users as UsersIcon,
  Link2,
  CheckSquare,
  MailWarning,
  MailCheck,
  Building2,
  Shield,
  Map,
  DollarSign,
  Video,
  Code2,
  Zap,
  History,
  Workflow,
  ExternalLink as LinkIcon,
  Sparkles,
  Search,
  ChevronDown,
  BarChart3,
  Layers,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/hooks/useUser';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useUserPermissions, useIsViewingAsExternal } from '@/contexts/UserPermissionsContext';
import { getNavigationItems } from '@/lib/routes/routeConfig';
import logger from '@/lib/utils/logger';
import { useEventListener } from '@/lib/communication/EventBus';
import { useTaskNotifications } from '@/lib/hooks/useTaskNotifications';
import { SmartSearch } from '@/components/SmartSearch';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { useBrandingSettings } from '@/lib/hooks/useBrandingSettings';
import { useTheme } from '@/hooks/useTheme';
import { TrialBanner } from '@/components/subscription/TrialBanner';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { userData, isImpersonating, stopImpersonating } = useUser();
  const { signOut } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, toggleMobileMenu] = useCycle(false, true);
  const [hasMounted, setHasMounted] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSmartSearchOpen, setIsSmartSearchOpen] = useState(false);
  const navigate = useNavigate();
  const { openCopilot } = useCopilot();
  const { settings: brandingSettings } = useBrandingSettings();
  const { resolvedTheme } = useTheme();

  // User permissions for dynamic navigation
  const { effectiveUserType, isAdmin, isInternal, isPlatformAdmin, isOrgAdmin } = useUserPermissions();
  const isViewingAsExternal = useIsViewingAsExternal();

  // Initialize task notifications - this will show toasts for auto-created tasks
  useTaskNotifications();

  // Open/close QuickAdd via global modal events
  useEventListener('modal:opened', ({ type, context }) => {
    if (type === 'quick-add') {
      setIsQuickAddOpen(true);
    }
  }, []);
  useEventListener('modal:closed', ({ type }) => {
    if (type === 'quick-add') {
      setIsQuickAddOpen(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      if (isImpersonating) {
        // Stop impersonating instead of logging out
        await stopImpersonating();
      } else {
        // Normal logout
        const { error } = await signOut();
        if (error) {
          toast.error('Error logging out: ' + error.message);
        }
      }
      // Success toast is handled by the respective functions
    } catch (error: any) {
      toast.error(isImpersonating ? 'Error stopping impersonation' : 'Error logging out');
      logger.error('[Auth]', error);
    }
  };

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Auto-collapse sidebar on specific pages for more space
  useEffect(() => {
    const collapsedPages = ['/email', '/calendar', '/workflows', '/freepik-flow'];
    const shouldCollapse = collapsedPages.includes(location.pathname);
    
    if (shouldCollapse) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  // Keyboard shortcut for SmartSearch (⌘K) - Disabled
  // useEffect(() => {
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
  //       e.preventDefault();
  //       setIsSmartSearchOpen(true);
  //     }
  //   };

  //   document.addEventListener('keydown', handleKeyDown);
  //   return () => document.removeEventListener('keydown', handleKeyDown);
  // }, []);

  // Dynamic navigation based on user type (internal vs external)
  // Uses centralized route config with access levels
  const menuItems = useMemo(() => {
    // Get main section navigation items
    const mainItems = getNavigationItems(effectiveUserType, isAdmin, isOrgAdmin, 'main');
    // Get tools section for internal users
    const toolsItems = getNavigationItems(effectiveUserType, isAdmin, isOrgAdmin, 'tools');

    // Type for menu items (compatible with existing template)
    type MenuItem = {
      icon: typeof Activity;
      label: string;
      href: string;
      badge?: string;
      subItems?: Array<{ icon: typeof Activity; label: string; href: string }>;
    };

    // Map route configs to menu item format
    const mapToMenuItem = (config: ReturnType<typeof getNavigationItems>[number]): MenuItem => ({
      icon: config.icon || Activity,
      label: config.label || '',
      href: config.path,
      badge: config.badge,
      subItems: undefined, // Route config doesn't have subItems, they can be added if needed
    });

    // Combine main and tools items for the menu
    return [...mainItems.map(mapToMenuItem), ...toolsItems.map(mapToMenuItem)];
  }, [effectiveUserType, isAdmin, isOrgAdmin]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gradient-to-br dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-[#1E293B] dark:text-gray-100 transition-colors duration-200">
      {/* View Mode Banner at the top */}
      <ViewModeBanner />

      {/* External View Banner - shown when internal user is viewing as external */}
      <ExternalViewBanner />

      {/* Trial Banner - shown when organization is in trial period */}
      <TrialBanner />

      {/* Main app content */}
      <div className="flex">
        {/* Legacy Impersonation Banner (will be removed once View As is fully working) */}
        {isImpersonating && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/10 backdrop-blur-sm text-center py-1 px-2 text-amber-400 text-xs font-medium border-b border-amber-500/20">
            <span className="flex items-center justify-center gap-1">
              <UserX className="w-3 h-3" /> You are impersonating {userData?.first_name} {userData?.last_name}
            </span>
          </div>
        )}
      
      <div className={cn(
      "fixed top-0 left-0 right-0 flex items-center justify-between z-50 p-4 bg-white/80 dark:bg-gray-950/50 backdrop-blur-sm border-b border-[#E2E8F0] dark:border-gray-800/50 lg:hidden transition-colors duration-200",
      isImpersonating ? "mt-6" : ""
    )}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            {userData?.avatar_url ? (
              <img
                src={userData.avatar_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#37bd7e]/20 flex items-center justify-center">
                <span className="text-sm font-medium text-[#37bd7e]">
                  {userData?.first_name?.[0] || ''}{userData?.last_name?.[0] || ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {userData?.first_name} {userData?.last_name}
            </span>
            <span className="text-xs text-gray-700 dark:text-gray-300">{userData?.stage}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {effectiveUserType !== 'external' && (
            <>
              <EmailIcon />
              <CalendarIcon />
              <NotificationBell />
            </>
          )}
          <motion.button
            animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
            onClick={() => toggleMobileMenu()}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800/50 hover:bg-slate-50 dark:hover:bg-gray-800/70 transition-colors lg:hidden"
          >
            <MenuIcon className="w-6 h-6 text-[#64748B] dark:text-gray-400" />
          </motion.button>
        </div>
      </div>
      
      {/* Quick Add FAB - Only shown in internal view */}
      {location.pathname !== '/workflows' && !isViewingAsExternal && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsQuickAddOpen(true)}
          className="fixed bottom-6 right-6 p-4 rounded-full bg-[#37bd7e] hover:bg-[#2da76c] transition-colors shadow-lg shadow-[#37bd7e]/20 z-50"
        >
          <Plus className="w-6 h-6 text-white" />
        </motion.button>
      )}

      {/* Mobile Menu - Full Page with Scrolling */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => toggleMobileMenu()}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className="fixed inset-0 w-full bg-white dark:bg-gray-900/95 backdrop-blur-xl z-50 lg:hidden transition-colors duration-200 flex flex-col"
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 p-4 sm:p-6 border-b border-[#E2E8F0] dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden">
                      {userData?.avatar_url ? (
                        <img
                          src={userData.avatar_url}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#37bd7e]/20 flex items-center justify-center">
                          <span className="text-base sm:text-lg font-medium text-[#37bd7e]">
                            {userData?.first_name?.[0]}{userData?.last_name?.[0]}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base sm:text-lg font-semibold text-[#1E293B] dark:text-gray-100">
                        {userData?.first_name} {userData?.last_name}
                      </span>
                      <span className="text-xs sm:text-sm text-[#64748B] dark:text-gray-300">{userData?.stage}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleMobileMenu()}
                    className="p-2 sm:p-3 min-h-[44px] min-w-[44px] hover:bg-slate-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Scrollable Navigation */}
              <div className="flex-1 overflow-y-auto">
                <nav className="p-4 sm:p-6 space-y-1 sm:space-y-2">
                  {menuItems.map((item) => (
                    <div key={item.href + item.label}>
                      <Link
                        to={item.href}
                        onClick={() => toggleMobileMenu()}
                        className={cn(
                          'w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 min-h-[56px] sm:min-h-[64px] rounded-xl text-base sm:text-lg font-medium transition-colors active:scale-[0.98]',
                          location.pathname === item.href || (item.subItems && item.subItems.some(sub => location.pathname === sub.href))
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                            : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                        )}
                      >
                        <item.icon className={cn(
                          'w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0',
                          location.pathname === item.href || (item.subItems && item.subItems.some(sub => location.pathname === sub.href))
                            ? 'text-indigo-700 dark:text-white' : 'text-[#64748B] dark:text-gray-400/80'
                        )} />
                        <span>{item.label}</span>
                      </Link>

                      {item.subItems && (
                        <div className="ml-10 sm:ml-12 mt-1 space-y-1">
                          {item.subItems.map((subItem) => (
                            <Link
                              key={subItem.href + subItem.label}
                              to={subItem.href}
                              onClick={() => toggleMobileMenu()}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 min-h-[48px] rounded-xl text-sm font-medium transition-colors',
                                location.pathname === subItem.href
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                                  : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                              )}
                            >
                              <subItem.icon className="w-5 h-5" />
                              <span>{subItem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </div>

              {/* Fixed Footer with Settings and Logout */}
              <div className="flex-shrink-0 p-4 sm:p-6 border-t border-[#E2E8F0] dark:border-gray-800 space-y-2">
                <Link
                  to="/settings/ai"
                  onClick={() => toggleMobileMenu()}
                  className={cn(
                    "flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 min-h-[56px] rounded-xl text-base sm:text-lg font-medium transition-colors active:scale-[0.98]",
                    location.pathname === '/settings/ai'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                      : 'text-[#64748B] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50'
                  )}
                >
                  <Settings className="w-6 h-6 sm:w-7 sm:h-7" />
                  User Settings
                </Link>

                {/* Org Admin - for org owners/admins */}
                {isOrgAdmin && (
                  <Link
                    to="/org"
                    onClick={() => toggleMobileMenu()}
                    className={cn(
                      "flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 min-h-[56px] rounded-xl text-base sm:text-lg font-medium transition-colors active:scale-[0.98]",
                      location.pathname.startsWith('/org')
                        ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-white dark:border-blue-800/20'
                        : 'text-[#64748B] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
                    Team
                  </Link>
                )}

                {/* Platform Admin - internal admins only */}
                {isPlatformAdmin && (
                  <Link
                    to="/platform"
                    onClick={() => toggleMobileMenu()}
                    className={cn(
                      "flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 min-h-[56px] rounded-xl text-base sm:text-lg font-medium transition-colors active:scale-[0.98]",
                      location.pathname.startsWith('/platform')
                        ? 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:text-white dark:border-purple-800/20'
                        : 'text-[#64748B] dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800/50'
                    )}
                  >
                    <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
                    Platform Admin
                  </Link>
                )}

                {/* External View Toggle for internal users on mobile */}
                {isInternal && (
                  <div className="px-4 sm:px-5 py-2">
                    <ExternalViewToggle showLabel={true} variant="ghost" className="w-full justify-start text-base sm:text-lg min-h-[48px]" />
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className={cn(
                    "w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 min-h-[56px] rounded-xl text-base sm:text-lg font-medium transition-colors active:scale-[0.98]",
                    isImpersonating
                      ? "text-amber-400 hover:bg-amber-500/10"
                      : "text-red-400 hover:bg-red-500/10"
                  )}
                >
                  {isImpersonating ? (
                    <>
                      <UserX className="w-6 h-6 sm:w-7 sm:h-7" />
                      Stop Impersonation
                    </>
                  ) : (
                    <>
                      <LogOut className="w-6 h-6 sm:w-7 sm:h-7" />
                      Logout
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Top Bar */}
      <div className={cn(
        'fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-950/50 backdrop-blur-sm border-b border-[#E2E8F0] dark:border-gray-800/50 z-[90]',
        'hidden lg:flex items-center justify-between px-6',
        isCollapsed ? 'lg:left-[80px]' : 'lg:left-[256px]',
        'transition-all duration-300 ease-in-out',
        isImpersonating ? 'top-6' : 'top-0'
      )}>
        {/* Search Button (cmdK) - Hidden */}
        {/* <button
          onClick={() => setIsSmartSearchOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800/70 transition-colors text-sm text-gray-600 dark:text-gray-400"
        >
          <Search className="w-4 h-4" />
          <span className="hidden xl:inline">Search...</span>
          <kbd className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </button> */}

        {/* User Profile with Dropdown */}
        <div className="flex items-center gap-3 ml-auto">
          <ThemeToggle />
          {effectiveUserType !== 'external' && (
            <>
              <EmailIcon />
              <CalendarIcon />
              <NotificationBell />
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800/50 transition-colors">
                <div className="w-8 h-8 rounded-lg overflow-hidden">
                  {userData?.avatar_url ? (
                    <img
                      src={userData.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#37bd7e]/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-[#37bd7e]">
                        {userData?.first_name?.[0] || ''}{userData?.last_name?.[0] || ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="hidden xl:flex flex-col items-start">
                  <span className="text-sm font-semibold text-[#1E293B] dark:text-gray-100">
                    {userData?.first_name} {userData?.last_name}
                  </span>
                  <span className="text-xs text-[#64748B] dark:text-gray-400">{userData?.stage}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 hidden xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <UserCog className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings/ai')}>
                <Settings className="w-4 h-4 mr-2" />
                Meetings Settings
              </DropdownMenuItem>
              {/* Org Admin - for org owners/admins */}
              {isOrgAdmin && (
                <DropdownMenuItem onClick={() => navigate('/org')}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Team
                </DropdownMenuItem>
              )}
              {/* Platform Admin - internal admins only */}
              {isPlatformAdmin && (
                <DropdownMenuItem onClick={() => navigate('/platform')}>
                  <Shield className="w-4 h-4 mr-2" />
                  Platform Admin
                </DropdownMenuItem>
              )}
              {/* External View Toggle - only for internal users */}
              {isInternal && (
                <>
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
                  <div className="px-2 py-1.5">
                    <ExternalViewToggle variant="menu" />
                  </div>
                </>
              )}

              {/* Product Pages Links */}
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <DropdownMenuItem onClick={() => window.open('/product/meetings', '_blank')}>
                <Eye className="w-4 h-4 mr-2" />
                View Sales Page
                <LinkIcon className="w-3 h-3 ml-auto text-gray-400" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/product/meetings/pricing', '_blank')}>
                <DollarSign className="w-4 h-4 mr-2" />
                View Pricing
                <LinkIcon className="w-3 h-3 ml-auto text-gray-400" />
              </DropdownMenuItem>

              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:text-red-500 hover:bg-red-500/10">
                {isImpersonating ? (
                  <>
                    <UserX className="w-4 h-4 mr-2" />
                    Stop Impersonation
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <motion.div
        initial={!hasMounted ? { opacity: 0, x: -20 } : false}
        animate={!hasMounted ? { opacity: 1, x: 0 } : false}
        className={cn(
          'fixed left-0 bottom-0 h-screen bg-white dark:bg-gray-900/50 backdrop-blur-xl p-6',
          'border-r border-[#E2E8F0] dark:border-gray-800/50 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.04)] dark:shadow-none',
          'transition-all duration-300 ease-in-out flex-shrink-0',
          isCollapsed ? 'w-[80px]' : 'w-[256px]',
          'hidden lg:block z-[100]',
          isImpersonating ? 'top-6' : 'top-0'
        )}
      >
        {/* Clickable border to minimize sidebar - only height of top bar, slightly thicker */}
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute right-0 top-0 w-[2px] h-16 bg-slate-300 dark:bg-gray-700 cursor-pointer hover:bg-slate-400 dark:hover:bg-gray-600 transition-all z-[101]',
            'hover:w-[3px]'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
        
        <div className="flex h-full flex-col">
          {/* Logo space at top */}
          <div className={cn(
            'mb-8',
            isCollapsed ? 'flex justify-center' : 'flex items-center justify-center'
          )}>
            <Link to="/" className={cn(
              'transition-opacity hover:opacity-80',
              isCollapsed ? 'w-10 h-10' : 'w-full h-12'
            )}>
              {(() => {
                // When collapsed, show icon if available, otherwise show logo
                if (isCollapsed) {
                  const iconUrl = brandingSettings?.icon_url || 'https://www.sixtyseconds.ai/images/logo.png';
                  return (
                    <img
                      key={`icon-${resolvedTheme}`}
                      src={iconUrl}
                      alt="Logo"
                      className="w-10 h-10 object-contain"
                    />
                  );
                }
                
                // When expanded, show theme-appropriate logo
                const darkLogo = brandingSettings?.logo_dark_url;
                const lightLogo = brandingSettings?.logo_light_url;
                const fallbackLogo = 'https://www.sixtyseconds.ai/images/logo.png';

                const logoUrl = resolvedTheme === 'dark'
                  ? (darkLogo || lightLogo || fallbackLogo)
                  : (lightLogo || darkLogo || fallbackLogo);

                return (
                  <img
                    key={`logo-${resolvedTheme}-${logoUrl}`}
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-12 object-contain"
                  />
                );
              })()}
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <nav className="space-y-2 pb-6">
              {menuItems.map((item) => (
                <div key={item.href + item.label}>
                  <Link
                    to={item.href}
                    className={cn(
                      'w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      location.pathname === item.href || (item.subItems && item.subItems.some(sub => location.pathname === sub.href))
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                        : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                    )}
                  >
                    <motion.div
                      animate={{
                        x: isCollapsed ? 0 : 0,
                        scale: isCollapsed ? 1.1 : 1
                      }}
                      className={cn(
                        'relative z-10 min-w-[20px] flex items-center justify-center',
                        location.pathname === item.href || (item.subItems && item.subItems.some(sub => location.pathname === sub.href))
                          ? 'text-indigo-700 dark:text-white' : 'text-[#64748B] dark:text-gray-400/80'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                    </motion.div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                  
                  {item.subItems && !isCollapsed && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href + subItem.label}
                          to={subItem.href}
                          className={cn(
                            'w-full flex items-center gap-3 px-2 py-2 rounded-xl text-xs font-medium transition-colors',
                            location.pathname === subItem.href
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                              : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                          )}
                        >
                          <subItem.icon className="w-3.5 h-3.5" />
                          <span>{subItem.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
          
          {/* Settings and Logout at bottom */}
          <div className="mt-auto pt-6 border-t border-[#E2E8F0] dark:border-gray-800/50">
            <Link
              to="/settings/ai"
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors mb-2',
                location.pathname === '/settings/ai'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-sm dark:bg-[#37bd7e]/10 dark:text-white dark:border-[#37bd7e]/20'
                  : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
              )}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    User Settings
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
            
            {/* Org Admin link - for org owners/admins */}
            {isOrgAdmin && (
              <Link
                to="/org"
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors mb-2',
                  location.pathname.startsWith('/org')
                    ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-white dark:border-blue-800/20'
                    : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                )}
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      Team
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}

            {/* Platform Admin link - internal admins only */}
            {isPlatformAdmin && (
              <Link
                to="/platform"
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors mb-2',
                  location.pathname.startsWith('/platform')
                    ? 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-900/20 dark:text-white dark:border-purple-800/20'
                    : 'text-[#64748B] hover:bg-slate-50 dark:text-gray-400/80 dark:hover:bg-gray-800/20'
                )}
              >
                <Shield className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      Platform Admin
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isImpersonating
                  ? 'text-amber-400 hover:bg-amber-500/10'
                  : 'text-red-400 hover:bg-red-500/10'
              )}
            >
              {isImpersonating ? (
                <>
                  <UserX className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        Stop Impersonation
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        Logout
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
      <main className={cn(
        'flex-1 transition-[margin] duration-300 ease-in-out',
        isCollapsed ? 'lg:ml-[80px]' : 'lg:ml-[256px]',
        'ml-0',
        isImpersonating ? 'pt-22 lg:pt-22' : 'pt-16 lg:pt-16'
      )}>
        {children}
        <QuickAdd isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
        {/* SmartSearch - Hidden */}
        {/* <SmartSearch
          isOpen={isSmartSearchOpen}
          onClose={() => setIsSmartSearchOpen(false)}
          onOpenCopilot={() => {
            navigate('/copilot');
            setIsSmartSearchOpen(false);
          }}
          onDraftEmail={(contactId, contactEmail) => {
            // Navigate to email page with contact information
            if (contactEmail) {
              navigate(`/email?to=${encodeURIComponent(contactEmail)}`);
            } else {
              navigate('/email');
            }
            setIsSmartSearchOpen(false);
          }}
          onAddContact={() => {
            navigate('/crm?tab=contacts');
            setIsSmartSearchOpen(false);
          }}
          onScheduleMeeting={(contactId) => {
            // Navigate to meetings page, optionally with contact pre-selected
            if (contactId) {
              navigate(`/meetings?contact=${contactId}`);
            } else {
              navigate('/meetings');
            }
            setIsSmartSearchOpen(false);
          }}
          onSelectContact={(contactId) => {
            navigate(`/crm/contacts/${contactId}`);
            setIsSmartSearchOpen(false);
          }}
          onSelectMeeting={(meetingId) => {
            navigate(`/meetings/${meetingId}`);
            setIsSmartSearchOpen(false);
          }}
          onSelectCompany={(companyId) => {
            navigate(`/crm/companies/${companyId}`);
            setIsSmartSearchOpen(false);
          }}
          onSelectDeal={(dealId) => {
            navigate(`/crm/deals/${dealId}`);
            setIsSmartSearchOpen(false);
          }}
          onAskCopilot={(query) => {
            openCopilot(query, true); // Start a new chat for each search query
            navigate('/copilot');
            setIsSmartSearchOpen(false);
          }}
        /> */}
      </main>
    </div>
    </div>
  );
}