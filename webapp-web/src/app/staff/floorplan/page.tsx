'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Staff Floor Plans → redirect to the shared Floor Plans page
export default function StaffFloorPlanRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/floorplans');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
    </div>
  );
}
