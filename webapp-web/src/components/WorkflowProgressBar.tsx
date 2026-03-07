'use client';

export type WorkflowStepStatus = 'pending' | 'in_progress' | 'complete' | 'overridden' | 'skipped';

export interface WorkflowStep {
  id: string;
  job_id: string;
  step_number: number;
  step_name: string;
  status: WorkflowStepStatus;
  completed_at?: string | null;
  completed_by?: string | null;
  override_reason?: string | null;
}

const STEP_LABELS = [
  'File Creation',
  'Dispatch',
  'Work Auth',
  'Day-1 Evidence',
  'Content Inventory',
  'Equipment Placement',
  '24-Hr Report',
  'Floor Plan Scan',
  'Moisture Map Setup',
  'Daily Drying Logs',
  'Drying Goal Met',
  'Equipment Removal',
  'Final Scope / Est.',
  'Job Close Checklist',
  'Invoicing & Close',
];

const STATUS_COLORS: Record<WorkflowStepStatus, { bg: string; border: string; text: string; dot: string }> = {
  complete:    { bg: 'bg-green-100',  border: 'border-green-500',  text: 'text-green-700',  dot: 'bg-green-500'  },
  in_progress: { bg: 'bg-blue-100',   border: 'border-blue-500',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  overridden:  { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700', dot: 'bg-orange-500' },
  skipped:     { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  pending:     { bg: 'bg-gray-100',   border: 'border-gray-300',   text: 'text-gray-400',   dot: 'bg-gray-300'   },
};

interface WorkflowProgressBarProps {
  steps?: WorkflowStep[];
  currentStep?: number;
  compact?: boolean;
}

export default function WorkflowProgressBar({ steps, currentStep = 1, compact = false }: WorkflowProgressBarProps) {
  // Build display steps from DB data or defaults
  const displaySteps = STEP_LABELS.map((label, i) => {
    const stepNum = i + 1;
    const dbStep = steps?.find(s => s.step_number === stepNum);
    let status: WorkflowStepStatus = 'pending';
    if (dbStep) {
      status = dbStep.status;
    } else if (stepNum < currentStep) {
      status = 'complete';
    } else if (stepNum === currentStep) {
      status = 'in_progress';
    }
    return { stepNum, label, status, dbStep };
  });

  const completedCount = displaySteps.filter(s => s.status === 'complete' || s.status === 'overridden').length;
  const progressPct = Math.round((completedCount / 15) * 100);

  if (compact) {
    // Compact version: just a progress bar with percentage
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-600">Workflow Progress</span>
          <span className="text-xs font-bold text-blue-600">{progressPct}% ({completedCount}/15)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-800">15-Step Workflow</h3>
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {progressPct}% Complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Step grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {displaySteps.map(({ stepNum, label, status }) => {
          const colors = STATUS_COLORS[status];
          return (
            <div
              key={stepNum}
              className={`relative rounded-lg border p-2 text-center transition-all ${colors.bg} ${colors.border}`}
              title={`Step ${stepNum}: ${label} — ${status.replace('_', ' ')}`}
            >
              <div className={`w-4 h-4 rounded-full mx-auto mb-1 flex items-center justify-center text-white text-[9px] font-bold ${colors.dot}`}>
                {status === 'complete' ? '✓' : status === 'overridden' ? '⚡' : stepNum}
              </div>
              <p className={`text-[9px] leading-tight font-medium ${colors.text}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <span className="text-[10px] text-gray-500 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
