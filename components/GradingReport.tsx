'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Lightbulb,
  XCircle,
} from 'lucide-react';
import type { QuestionType, SimulatorState, SubmitResponse } from '@/lib/types';
import SimulatorRenderer from './simulators/SimulatorRenderer';

interface GradingReportProps {
  type: QuestionType;
  result: SubmitResponse;
  studentAnswer: SimulatorState;
}

export default function GradingReport({
  type,
  result,
  studentAnswer,
}: GradingReportProps) {
  const [compareTab, setCompareTab] = useState<'none' | 'reference' | 'mine'>(
    'none'
  );

  const pct =
    result.maxScore > 0
      ? Math.round((result.finalScore / result.maxScore) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Score Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">本次得分</div>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span
                className={`text-3xl font-bold ${
                  pct >= 80
                    ? 'text-teal-700'
                    : pct >= 60
                      ? 'text-sky-700'
                      : 'text-red-600'
                }`}
              >
                {result.finalScore}
              </span>
              <span className="text-sm text-slate-500">/ {result.maxScore} 分</span>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 space-y-0.5 tabular-nums">
            <div>规则判分：{result.autoScore} 分</div>
            {result.hintPenalty > 0 && (
              <div className="text-amber-700">
                提示扣分：-{result.hintPenalty} 分（使用 {result.hintsUsedCount} 次）
              </div>
            )}
            {result.gradedByAi && (
              <div className="text-sky-700">含大模型辅助评分</div>
            )}
          </div>
        </div>
      </div>

      {/* Checkpoint Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">分步得分明细</h3>
        <div className="divide-y divide-slate-100">
          {result.checkpointResults.map((cp) => (
            <div key={cp.checkpointId} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {cp.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-xs font-medium text-slate-900">
                      步骤 {cp.stepIndex} · {cp.description}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {cp.feedback}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums shrink-0 ${
                    cp.passed ? 'text-teal-700' : 'text-red-600'
                  }`}
                >
                  {cp.earnedScore}/{cp.maxScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compare Reference Answer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">参考答案对比</h3>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() =>
                setCompareTab(compareTab === 'reference' ? 'none' : 'reference')
              }
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                compareTab === 'reference'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              <Eye className="w-3 h-3 inline mr-1" />
              参考答案视图
            </button>
            <button
              type="button"
              onClick={() =>
                setCompareTab(compareTab === 'mine' ? 'none' : 'mine')
              }
              className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                compareTab === 'mine'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              我的作答视图
            </button>
          </div>
        </div>

        {compareTab !== 'none' && (
          <div className="h-[360px] border border-slate-200 rounded-lg overflow-hidden">
            <SimulatorRenderer
              type={type}
              value={
                compareTab === 'reference'
                  ? result.referenceAnswer
                  : studentAnswer
              }
              readOnly
            />
          </div>
        )}
      </div>

      {/* Analysis */}
      {result.analysis.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-sky-600" />
            <span>操作路径与详细解析</span>
          </h3>
          <ol className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
            {result.analysis.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Common Mistakes */}
      {result.commonMistakes.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>常见错误提醒</span>
          </h3>
          <ul className="space-y-1 text-xs text-amber-900 list-disc pl-4">
            {result.commonMistakes.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
