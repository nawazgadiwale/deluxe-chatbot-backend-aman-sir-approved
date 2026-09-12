"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock, RefreshCw } from "lucide-react";
import { getStepLabel, getWorkflowLabel } from "../../../utils/stepLabels";

// =====================================================
// UNFINISHED WORKFLOW CARD
// =====================================================
//
// Shown on the WelcomeScreen when the backend indicates
// the visitor has an active but incomplete workflow.
//
// Priority: HIGHEST — shown above all other sections.
//
// Actions:
//   [Continue]          → RESUME_WORKFLOW action → backend
//   [Start Something New] → clearChat() → new session
//
// =====================================================

export default function UnfinishedWorkflowCard({
  workflow = null,
  currentStep = null,
  onContinue,
  onStartNew,
  disabled = false,
}) {
  const workflowLabel = getWorkflowLabel(workflow);
  const stepLabel = getStepLabel(currentStep);

  const isSalesWorkflow = workflow === "SALES";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm"
    >
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex items-start gap-3 px-5 py-4">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock size={18} className="text-amber-700" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Unfinished request
          </p>

          <h3 className="mt-0.5 font-semibold text-slate-900">
            You have an unfinished {workflowLabel.toLowerCase()}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <span className="text-slate-400">You were at:</span>

            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
              {stepLabel}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          ACTIONS
      ===================================================== */}

      <div className="flex gap-3 border-t border-amber-200 bg-white px-5 py-4">
        {/* Continue */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={disabled}
          onClick={onContinue}
          className="
            flex
            flex-1
            items-center
            justify-center
            gap-2

            rounded-xl

            bg-blue-600
            px-4
            py-2.5

            text-sm
            font-semibold
            text-white

            shadow-sm

            transition-colors

            hover:bg-blue-700

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <RefreshCw size={15} />
          Continue {isSalesWorkflow ? "Order" : "Request"}
        </motion.button>

        {/* Start new */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={disabled}
          onClick={onStartNew}
          className="
            flex
            flex-1
            items-center
            justify-center
            gap-2

            rounded-xl

            border
            border-slate-200

            bg-white

            px-4
            py-2.5

            text-sm
            font-medium
            text-slate-700

            shadow-sm

            transition-colors

            hover:border-slate-300
            hover:bg-slate-50

            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          Start New
          <ArrowRight size={15} />
        </motion.button>
      </div>
    </motion.div>
  );
}
