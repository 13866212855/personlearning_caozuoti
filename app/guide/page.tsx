'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import StepGuideShowcase from '@/components/guide/StepGuideShowcase';

function GuidePageContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || undefined;
  const stepStr = searchParams.get('step');
  const stepNumber = stepStr ? Number(stepStr) : undefined;
  const questionTitle = searchParams.get('title') || undefined;
  const stepInstruction = searchParams.get('instruction') || undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              操作题小白图文演示中心
            </h1>
            <p className="text-[11px] text-slate-500">
              手把手分解每一步工具栏位置与常见坑点
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回练习首页</span>
        </Link>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <StepGuideShowcase
          topicId={topic}
          stepNumber={Number.isFinite(stepNumber) ? stepNumber : undefined}
          questionTitle={questionTitle}
          stepInstruction={stepInstruction}
          allowTopicSwitch={true}
        />
      </main>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          <span>正在加载操作演示页面...</span>
        </div>
      }
    >
      <GuidePageContent />
    </Suspense>
  );
}
