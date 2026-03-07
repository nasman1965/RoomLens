'use client';

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface DeadlineCountdownProps {
  createdAt: string; // ISO date string from job.created_at
  reportDeadlineHours?: number; // default 24
  scopeDeadlineDays?: number;   // default 5
}

function getTimeLeft(targetMs: number) {
  const now = Date.now();
  const diff = targetMs - now;
  return diff;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'OVERDUE';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function getColorClass(ms: number, totalMs: number): {
  bg: string; border: string; text: string; badge: string; pulse: boolean
} {
  if (ms <= 0) return {
    bg: 'bg-red-900',
    border: 'border-red-500',
    text: 'text-red-100',
    badge: 'bg-red-500 text-white',
    pulse: true
  };
  const pct = ms / totalMs;
  if (pct > 0.5) return {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
    pulse: false
  };
  if (pct > 0.25) return {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-700',
    pulse: false
  };
  // < 4 hours (for 24hr) or < 25% time left
  return {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    pulse: true
  };
}

export default function DeadlineCountdown({
  createdAt,
  reportDeadlineHours = 24,
  scopeDeadlineDays = 5,
}: DeadlineCountdownProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const createdMs = new Date(createdAt).getTime();
  const reportTotalMs = reportDeadlineHours * 60 * 60 * 1000;
  const scopeTotalMs = scopeDeadlineDays * 24 * 60 * 60 * 1000;

  const reportDeadlineMs = createdMs + reportTotalMs;
  const scopeDeadlineMs = createdMs + scopeTotalMs;

  const reportLeft = getTimeLeft(reportDeadlineMs);
  const scopeLeft = getTimeLeft(scopeDeadlineMs);

  const reportColors = getColorClass(reportLeft, reportTotalMs);
  const scopeColors = getColorClass(scopeLeft, scopeTotalMs);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* 24-Hr Report Deadline */}
      <div className={`flex-1 rounded-xl border-2 p-3 ${reportColors.bg} ${reportColors.border} transition-colors`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Clock className={`w-4 h-4 ${reportColors.text}`} />
          <span className={`text-xs font-semibold ${reportColors.text}`}>24-Hr Report Deadline</span>
          {reportLeft <= 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse ${reportColors.badge}`}>
              OVERDUE
            </span>
          )}
        </div>
        <div className={`text-xl font-mono font-bold ${reportLeft <= 0 ? 'text-red-300 animate-pulse' : reportColors.text}`}>
          {formatDuration(reportLeft)}
        </div>
        <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-1000 ${
              reportLeft <= 0 ? 'bg-red-500 w-full' :
              reportLeft / reportTotalMs > 0.5 ? 'bg-green-500' :
              reportLeft / reportTotalMs > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: reportLeft <= 0 ? '100%' : `${Math.max(0, (reportLeft / reportTotalMs) * 100)}%` }}
          />
        </div>
      </div>

      {/* 5-Day Scope Deadline */}
      <div className={`flex-1 rounded-xl border-2 p-3 ${scopeColors.bg} ${scopeColors.border} transition-colors`}>
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle className={`w-4 h-4 ${scopeColors.text}`} />
          <span className={`text-xs font-semibold ${scopeColors.text}`}>5-Day Scope Deadline</span>
          {scopeLeft <= 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse ${scopeColors.badge}`}>
              OVERDUE
            </span>
          )}
        </div>
        <div className={`text-xl font-mono font-bold ${scopeLeft <= 0 ? 'text-red-300 animate-pulse' : scopeColors.text}`}>
          {formatDuration(scopeLeft)}
        </div>
        <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-1000 ${
              scopeLeft <= 0 ? 'bg-red-500 w-full' :
              scopeLeft / scopeTotalMs > 0.5 ? 'bg-green-500' :
              scopeLeft / scopeTotalMs > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: scopeLeft <= 0 ? '100%' : `${Math.max(0, (scopeLeft / scopeTotalMs) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
