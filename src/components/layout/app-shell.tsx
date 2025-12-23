"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

function DemoBanner() {
  return (
    <div className="bg-gray-100 text-gray-600 px-4 py-1.5 text-center border-b border-gray-200">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs">
          <span className="font-medium">Demo Instance</span> —{" "}
          <strong className="text-gray-800">
            Do not enter real client or sensitive information.
          </strong>{" "}
          Want to use this for your firm?{" "}
          <a
            href="https://github.com/CaseMark/iolta-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Clone the repo
          </a>{" "}
          and deploy your own instance.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login");

  // Login page gets its own full-page layout
  if (isLoginPage) {
    return <>{children}</>;
  }

  // All other pages get the app shell with sidebar
  return (
    <div className="flex flex-col h-screen">
      {/* Demo Warning Banner - Always visible at top */}
      <DemoBanner />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background">
          <div className="min-h-full flex flex-col">
            <div className="flex-1">{children}</div>
            <footer className="bg-black text-white text-center py-1 text-xs">
              powered with ❤️ by case.dev
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

