'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Staff Welcome → redirect to staff dashboard
export default function StaffWelcomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/staff/dashboard');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
    </div>
  );
}
