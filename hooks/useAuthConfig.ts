'use client';

import { useEffect, useState } from 'react';
import {
  fetchAuthConfig,
  subscribeAuthConfig,
  type AuthConfig,
} from '@/lib/authConfig';

/**
 * 加载完成前返回 null：与成员管理、学科配置相关的控件先不闪现，
 * 同时订阅管理员更新学科后的刷新事件。
 */
export function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthConfig().then((cfg) => {
      if (active) setConfig(cfg);
    });
    const unsubscribe = subscribeAuthConfig((nextCfg) => {
      if (active) setConfig(nextCfg);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return config;
}
