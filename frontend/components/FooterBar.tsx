import { Info, Trash2, ArrowRight } from "lucide-react";
import { TherapeuticGoalId, THERAPEUTIC_GOALS } from "@/types/mechanism";

export default function FooterBar({
  onClear,
  onConfirm,
  selectedGoal,
  onSelectGoal,
}: {
  onClear: () => void;
  onConfirm: () => void;
  selectedGoal: TherapeuticGoalId | null;
  onSelectGoal: (goalId: TherapeuticGoalId) => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[12.5px] text-slate-500">
          <Info className="h-4 w-4 shrink-0 text-slate-400" />
          Please verify the above information. You can modify selections if needed before proceeding.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear All
          </button>
          <button
            onClick={onConfirm}
            disabled={!selectedGoal}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm & Proceed
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-slate-500">Therapeutic goal:</span>
        <div className="flex flex-wrap gap-1.5">
          {THERAPEUTIC_GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => onSelectGoal(goal.id)}
              title={goal.description}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                selectedGoal === goal.id
                  ? "bg-brand text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {goal.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
