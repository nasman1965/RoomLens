'use client';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex bg-[#0a0f1e] min-h-screen">
      {/* Sidebar handles its own desktop/mobile rendering */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto
        pt-14 lg:pt-0          /* top padding for mobile header */
        pb-20 lg:pb-0          /* bottom padding for mobile bottom nav */
        min-h-screen
      ">
        {children}
      </main>
    </div>
  );
}
