'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save, XCircle, Zap } from 'lucide-react';
import { adminFetch } from '@/lib/api';

interface LlmConfigView {
  baseUrl: string;
  apiKeyMasked: string;
  textModel: string;
  imageModel: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  updatedAt: string;
}

export default function AdminLlmConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [timeoutMs, setTimeoutMs] = useState(45000);

  const [testingText, setTestingText] = useState(false);
  const [textTestRes, setTextTestRes] = useState<{
    success: boolean;
    latencyMs: number;
    output?: string;
    error?: string;
  } | null>(null);

  const [testingImage, setTestingImage] = useState(false);
  const [imageTestRes, setImageTestRes] = useState<{
    success: boolean;
    latencyMs: number;
    imageUrl?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    adminFetch<LlmConfigView>('/api/admin/llm-config')
      .then((cfg) => {
        setBaseUrl(cfg.baseUrl);
        setApiKeyMasked(cfg.apiKeyMasked);
        setTextModel(cfg.textModel);
        setImageModel(cfg.imageModel);
        setTemperature(cfg.temperature);
        setMaxTokens(cfg.maxTokens);
        setTimeoutMs(cfg.timeoutMs);
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setErrorMsg('');
    try {
      const res = await adminFetch<{ apiKeyMasked: string }>(
        '/api/admin/llm-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            baseUrl: baseUrl.trim(),
            apiKey: newApiKey.trim() || undefined,
            textModel: textModel.trim(),
            imageModel: imageModel.trim(),
            temperature: Number(temperature),
            maxTokens: Number(maxTokens),
            timeoutMs: Number(timeoutMs),
          }),
        }
      );
      setApiKeyMasked(res.apiKeyMasked);
      setNewApiKey('');
      setSaveMsg('大模型配置已保存生效');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestText = async () => {
    setTestingText(true);
    setTextTestRes(null);
    try {
      const res = await adminFetch<{
        success: boolean;
        latencyMs: number;
        output?: string;
        error?: string;
      }>('/api/admin/llm-config/test-text', {
        method: 'POST',
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: newApiKey.trim() || undefined,
          textModel: textModel.trim(),
          timeoutMs: Number(timeoutMs),
        }),
      });
      setTextTestRes(res);
    } catch (err) {
      setTextTestRes({
        success: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : '请求失败',
      });
    } finally {
      setTestingText(false);
    }
  };

  const handleTestImage = async () => {
    setTestingImage(true);
    setImageTestRes(null);
    try {
      const res = await adminFetch<{
        success: boolean;
        latencyMs: number;
        imageUrl?: string;
        error?: string;
      }>('/api/admin/llm-config/test-image', {
        method: 'POST',
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: newApiKey.trim() || undefined,
          imageModel: imageModel.trim(),
          timeoutMs: Number(timeoutMs),
        }),
      });
      setImageTestRes(res);
    } catch (err) {
      setImageTestRes({
        success: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : '请求失败',
      });
    } finally {
      setTestingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 text-sky-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">大模型接口配置</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          配置兼容 OpenAI 协议的文本与图片生成接口。API Key 仅保存在后端数据库，前端仅展示脱敏形式。
        </p>
      </div>

      {saveMsg && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800">
          {saveMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm"
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Base URL
          </label>
          <input
            type="url"
            required
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            API Key（当前脱敏值：
            <span className="font-mono text-sky-700">
              {apiKeyMasked || '未配置'}
            </span>
            ，留空表示保持不变）
          </label>
          <input
            type="password"
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            placeholder="如需更换请粘贴新 API Key，否则留空"
            className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              文本生成模型 (Text Model)
            </label>
            <input
              type="text"
              required
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              图片生成模型 (Image Model)
            </label>
            <input
              type="text"
              required
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Temperature (0~2)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Max Tokens
            </label>
            <input
              type="number"
              min="256"
              max="32768"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              超时时间 (ms)
            </label>
            <input
              type="number"
              min="5000"
              max="180000"
              step="1000"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm tabular-nums"
            />
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>保存配置</span>
          </button>

          <button
            type="button"
            onClick={handleTestText}
            disabled={testingText}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            {testingText ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-sky-600" />
            )}
            <span>测试文本模型</span>
          </button>

          <button
            type="button"
            onClick={handleTestImage}
            disabled={testingImage}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            {testingImage ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-teal-600" />
            )}
            <span>测试图片模型</span>
          </button>
        </div>
      </form>

      {/* Test Results */}
      {textTestRes && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-1.5 ${
            textTestRes.success
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {textTestRes.success ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>
              文本模型测试{textTestRes.success ? '成功' : '失败'}
              {textTestRes.latencyMs > 0
                ? ` · 耗时 ${textTestRes.latencyMs} ms`
                : ''}
            </span>
          </div>
          <p className="whitespace-pre-wrap">
            {textTestRes.success ? textTestRes.output : textTestRes.error}
          </p>
        </div>
      )}

      {imageTestRes && (
        <div
          className={`p-4 rounded-xl border text-xs space-y-2 ${
            imageTestRes.success
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {imageTestRes.success ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span>
              图片模型测试{imageTestRes.success ? '成功' : '失败'}
              {imageTestRes.latencyMs > 0
                ? ` · 耗时 ${imageTestRes.latencyMs} ms`
                : ''}
            </span>
          </div>
          {imageTestRes.success && imageTestRes.imageUrl ? (
            <img
              src={imageTestRes.imageUrl}
              alt="图片模型测试预览"
              referrerPolicy="no-referrer"
              className="w-48 h-48 object-cover rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <p>{imageTestRes.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
