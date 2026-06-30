"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Heart,
  GraduationCap,
  User,
  Settings,
  ChevronRight,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Giving",
    href: "/giving",
    icon: Heart,
    children: [
      { name: "Overview", href: "/giving" },
      { name: "History", href: "/giving/history" },
    ],
  },
  {
    name: "Courses",
    href: "/courses",
    icon: GraduationCap,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-[#d9e1d2]/60 bg-transparent glass-subtle">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#d9e1d2]/60 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b4d24]">
            <Heart className="h-4 w-4 text-[#FFFEF9]" />
          </div>
          <span className="font-sans tracking-tight text-xl font-semibold text-[#2b4d24]">
            Favor
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#2b4d24] text-[#FFFEF9]"
                      : "text-[#6f7766] hover:bg-white/60 hover:text-[#1a1a1a]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                  {item.children && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </Link>

                {/* Child navigation */}
                {item.children && isActive && (
                  <ul className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const isChildActive = pathname === child.href;
                      return (
                        <li key={child.name}>
                          <Link
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                              isChildActive
                                ? "bg-[#2b4d24]/10 text-[#2b4d24]"
                                : "text-[#6f7766] hover:bg-white/60 hover:text-[#1a1a1a]"
                            )}
                          >
                            {child.name === "History" && <History className="h-4 w-4" />}
                            <span>{child.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-[#d9e1d2]/60 p-4">
        <p className="text-xs text-[#6f7766]">
          Favor International
        </p>
        <p className="text-xs text-[#6f7766]">
          Partner Portal v1.0
        </p>
      </div>
    </div>
  );
}
