"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  Bell,
  LogOut,
  User,
  Heart,
  GraduationCap,
  Home,
  FileText,
  Shield,
  Settings,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./notification-panel";
import { APP_CONFIG, getGivingTier } from "@/lib/constants";
import { DevTools } from "./dev-tools";

const BASE_NAV_ITEMS = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Giving", href: "/giving", icon: Heart },
  { name: "Courses", href: "/courses", icon: GraduationCap },
  { name: "Content", href: "/content", icon: FileText },
];

const ACCOUNT_NAV_ITEMS = [
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

interface PortalShellProps {
  children: React.ReactNode;
}

export function PortalShell({ children }: PortalShellProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const accountItems = useMemo(() => {
    if (user?.isAdmin) {
      return [...ACCOUNT_NAV_ITEMS, { name: "Admin", href: "/admin", icon: Shield }];
    }
    return ACCOUNT_NAV_ITEMS;
  }, [user]);

  const allItems = useMemo(() => [...BASE_NAV_ITEMS, ...accountItems], [accountItems]);

  const activeHref = useMemo(() => {
    const matches = allItems.filter((item) => {
      if (pathname === item.href) return true;
      if (item.href === "/dashboard") return false;
      return pathname.startsWith(`${item.href}/`);
    });
    if (matches.length === 0) return undefined;
    return matches.sort((a, b) => b.href.length - a.href.length)[0].href;
  }, [pathname, allItems]);

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : "??";

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "));

  const tierLabel = getGivingTier(user?.lifetimeGivingTotal ?? 0).name;

  const navLink = (item: { name: string; href: string; icon: typeof Home }, onNavigate?: () => void) => {
    const isActive = item.href === activeHref;
    const Icon = item.icon;
    return (
      <Link
        key={item.name + item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          isActive
            ? "bg-[#2b4d24] text-[#FFFEF9] shadow-[0_8px_24px_-18px_rgba(43,77,36,0.5)]"
            : "text-[#4f594a] hover:bg-white/60 hover:text-[#1a1a1a]"
        )}
      >
        <Icon className={cn("h-4 w-4", isActive ? "text-[#e1a730]" : "text-[#8b957b]")} />
        {item.name}
      </Link>
    );
  };

  const navSections = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      <div className="space-y-0.5">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8b0a0]">Portal</p>
        {BASE_NAV_ITEMS.map((item) => navLink(item, onNavigate))}
      </div>
      <div className="space-y-0.5">
        <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a8b0a0]">Account</p>
        {accountItems.map((item) => navLink(item, onNavigate))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-transparent lg:flex">
      {/* ─── Persistent desktop sidebar ─── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[#e5e0d6] bg-[#fffefa]/85 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src={APP_CONFIG.logo} alt="Favor International" width={150} height={40} className="h-9 w-auto" />
          </Link>
        </div>
        {navSections()}
        <div className="border-t border-[#e5e0d6] px-6 py-4">
          <p className="text-xs font-medium text-[#6f7766]">{APP_CONFIG.name}</p>
          <p className="text-[10px] italic text-[#a8b0a0]">{APP_CONFIG.tagline}</p>
        </div>
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass-bar sticky top-0 z-50">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile menu */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-[#8b957b] hover:text-[#2b4d24] lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 glass-elevated p-0 border-r-0">
                  <SheetHeader className="border-b border-[#e5e0d6]/40 px-5 py-4">
                    <SheetTitle className="flex items-center">
                      <Image src={APP_CONFIG.logo} alt="Favor International" width={130} height={32} className="h-8 w-auto" />
                    </SheetTitle>
                  </SheetHeader>
                  {navSections(() => setMenuOpen(false))}
                </SheetContent>
              </Sheet>

              {/* Mobile logo */}
              <Link href="/dashboard" className="flex items-center lg:hidden">
                <Image src={APP_CONFIG.logo} alt="Favor International" width={120} height={28} className="h-7 w-auto" />
              </Link>

              {/* Breadcrumb */}
              {segments.length > 0 && (
                <nav className="hidden items-center gap-1 text-sm text-[#8b957b] md:flex">
                  {segments.map((seg, i) => (
                    <span key={i}>
                      <span className={i === segments.length - 1 ? "font-medium text-[#1a1a1a]" : ""}>{seg}</span>
                      {i < segments.length - 1 && <span className="mx-1.5 text-[#c5ccc2]">/</span>}
                    </span>
                  ))}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 text-[#8b957b] hover:text-[#2b4d24]" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-[#e1a730]" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 sm:w-96 glass-elevated p-0 border-l-0">
                  <NotificationPanel onClose={() => setNotifOpen(false)} />
                </SheetContent>
              </Sheet>

              <DevTools />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-white/50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatarUrl} alt={`${user?.firstName} ${user?.lastName}`} />
                      <AvatarFallback className="bg-[#2b4d24] text-[#FFFEF9] text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium text-[#1a1a1a] md:inline">{user?.firstName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 glass-elevated rounded-xl border-[#e5e0d6]/40">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-[#8b957b]">{tierLabel}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#e5e0d6]/40" />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex cursor-pointer items-center gap-2"><User className="h-4 w-4" /> Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#e5e0d6]/40" />
                  <DropdownMenuItem onClick={signOut} className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        <footer className="glass-subtle border-t-0">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-2 px-4 py-6 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <p className="text-xs text-[#8b957b]">{APP_CONFIG.name} &middot; 3433 Lithia Pinecrest Rd #356, Valrico, FL 33596</p>
            <p className="text-xs italic text-[#8b957b]/70">{APP_CONFIG.tagline}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
