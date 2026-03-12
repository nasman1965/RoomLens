'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Staff Photos → redirect to the shared Photos page
// Staff can access it directly — the photos page handles auth
export default function StaffPhotosRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/photos');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
    </div>
  );
}
