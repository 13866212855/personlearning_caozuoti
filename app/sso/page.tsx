'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { fetchAuthConfig } from '@/lib/authConfig';
import { setCachedPortalUser, setPortalToken } from '@/lib/api';
import type { PortalUser } from '@/lib/types';

/**
 * 单点入口：学生或教师已在个性化学习平台登录，
 * 平台入口上的跳转页把平台凭证放在地址的 # 后面带过来，这里读出后交给后端核对身份。
 */
export default function SsoEntryPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [platformWebUrl, setPlatformWebUrl] = useState('');
  const [siteTitle, setSiteTitle] = useState('高中会考实操练习与测评系统');

  useEffect(() => {
    let active = true;
    void fetchAuthConfig().then((cfg) => {
      if (active) {
        setPlatformWebUrl(cfg.platformWebUrl);
        if (cfg.siteTitle) setSiteTitle(cfg.siteTitle);
      }
    });

    (async () => {
      await Promise.resolve();
      if (!active) return;

      // # 后面的内容浏览器不会发给服务器；读出后立刻把地址栏清干净
      const match = window.location.hash.match(/(?:^|[#&])t=([^&]+)/);
      const platformToken = match ? decodeURIComponent(match[1]) : '';
      window.history.replaceState(null, '', window.location.pathname);
      if (!platformToken) {
        setError('没有拿到平台登录凭证，请回到个性化学习平台重新进入');
        return;
      }

      try {
        const resp = await fetch('/api/auth/sso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platformToken }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data.error || `进入失败（${resp.status}）`);
        }
        const payload = data as { token: string; user: PortalUser };
        setPortalToken(payload.token);
        setCachedPortalUser(payload.user);
        router.replace(payload.user.role === 'teacher' ? '/teacher' : '/');
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : '进入失败，请重试');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {siteTitle}
          </h1>
          <p className="text-sm text-slate-500">
            {error ? '暂时无法从个性化学习平台进入' : '正在使用个性化学习平台账号进入...'}
          </p>
        </div>

        {error ? (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
            <div className="flex flex-col gap-2">
              {platformWebUrl && (
                <a
                  href={platformWebUrl}
                  className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg text-sm flex items-center justify-center"
                >
                  回到个性化学习平台
                </a>
              )}
              <a
                href="/login"
                className="w-full h-10 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm flex items-center justify-center"
              >
                使用账号密码登录
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
            <span>正在核对身份，请稍候...</span>
          </div>
        )}
      </div>
    </div>
  );
}
