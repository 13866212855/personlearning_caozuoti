'use client';

import { useEffect, useState } from 'react';
import { fetchAuthConfig, type AuthConfig } from '@/lib/authConfig';

/**
 * 加载完成前返回 null：与成员管理相关的控件先不显示，
 * 避免在平台对接模式下先闪现再消失（后端对这些操作一律返回 403）。
 */
export function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAuthConfig().then((cfg) => {
      if (active) setConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, []);

  return config;
}
