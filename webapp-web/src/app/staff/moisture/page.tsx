'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Staff Moisture Map → redirect to the shared Moisture Map page
export default function StaffMoistureRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/moisture');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
    </div>
  );
}
