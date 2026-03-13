import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import { Loader2 } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center h-full min-h-screen bg-[#0a0f1e]"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>}>
        {children}
      </Suspense>
    </AppShell>
  );
}
