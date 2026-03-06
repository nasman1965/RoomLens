'use client';
import Link from 'next/link';
export default function Page() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-6xl mb-4">📄</div>
      <h1 className="text-2xl font-extrabold mb-2" style={{color:'#0a1628'}}>Reports</h1>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Open a job from the Jobs page, then tap the Estimate Draft tile to generate Xactimate line items and export PDF reports.
      </p>
      <Link href="/jobs" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold" style={{background:'#0a1628'}}>
        ← Go to Jobs
      </Link>
    </div>
  );
}
