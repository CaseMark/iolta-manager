"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  BookOpen,
  FileText,
  Settings,
  Lock,
  ClipboardList,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Matters", href: "/matters", icon: Briefcase },
  { name: "Ledger", href: "/ledger", icon: BookOpen },
  { name: "Holds", href: "/holds", icon: Lock },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Audit Log", href: "/audit", icon: ClipboardList },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [firmName, setFirmName] = useState<string>("IOLTA Manager");
  const [firmLogo, setFirmLogo] = useState<string | null>(null);

  // Don't render sidebar on login page
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login');

  useEffect(() => {
    // Skip fetching settings on login page
    if (isLoginPage) return;
    
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.firmName) {
            setFirmName(data.firmName);
          }
          if (data.firmLogo) {
            setFirmLogo(data.firmLogo);
          }
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    }
    fetchSettings();
  }, [isLoginPage]);

  // Hide sidebar on login page
  if (isLoginPage) {
    return null;
  }

  return (
    <div className="flex h-full w-64 flex-col bg-neutral-950 border-r border-neutral-800">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-neutral-800">
        {firmLogo && (
          <img
            src={firmLogo}
            alt="Firm Logo"
            className="h-8 w-8 object-contain rounded"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-white tracking-tight truncate">{firmName}</h1>
          <p className="text-xs text-neutral-500">Trust Accounting</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
