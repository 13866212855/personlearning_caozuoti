'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DisabledPracticePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
      <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      <p className="text-sm text-slate-600">正在返回模拟考试中心...</p>
    </div>
  );
}
