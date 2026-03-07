import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import { Loader2 } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
        {children}
      </Suspense>
    </AppShell>
  );
}
