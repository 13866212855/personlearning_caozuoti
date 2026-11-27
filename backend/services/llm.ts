import fs from 'node:fs';
import path from 'node:path';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { APP_CONFIG } from '../config';
import { getDb } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import type {
  DifficultyLevel,
  Question,
  QuestionStatus,
  QuestionType,
  QuestionVisibility,
} from '../types';

export interface LlmConfigRow {
  id: number;
  base_url: string;
  api_key: string;
  text_model: string;
  image_model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
  teacher_daily_ai_limit: number;
  updated_at: string;
}

export function getLlmConfig(): LlmConfigRow {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM llm_configs WHERE id = 1')
    .get() as LlmConfigRow;
  return row;
}

export function getTeacherTodayAiUsage(teacherId: string): {
  used: number;
  limit: number;
  remaining: number;
} {
  const db = getDb();
  const cfg = getLlmConfig();
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(count), 0) as total
       FROM ai_generation_logs
       WHERE user_id = ? AND created_at LIKE ?`
    )
    .get(teacherId, `${todayPrefix}%`) as { total: number };
  const used = Number(row?.total || 0);
  const limit = Number(cfg.teacher_daily_ai_limit || 30);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export function recordAiGenerationUsage(
  userId: string,
  role: string,
  count: number
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ai_generation_logs (id, user_id, role, count, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    `aiu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    role,
    count,
    new Date().toISOString()
  );
}

function extractJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export function parseLlmJson(raw: string): Record<string, unknown> {
  const candidate = extractJsonBlock(raw);
  const attempts: Array<() => unknown> = [
    () => JSON.parse(candidate),
    () => JSON.parse(jsonrepair(candidate)),
    () => {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim();
      return JSON.parse(jsonrepair(cleaned));
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      let parsed = attempt();
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        parsed = parsed[0];
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (
          obj.question &&
          typeof obj.question === 'object' &&
          !Array.isArray(obj.question) &&
          !obj.steps
        ) {
          return obj.question as Record<string, unknown>;
        }
        return obj;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('模型输出不是合法 JSON 格式');
}

const StepSchema = z.object({
  index: z.number().int().min(1),
  instruction: z.string().min(3),
  score: z.number().positive(),
  hint: z.string().optional(),
});

const CheckpointSchema = z.object({
  id: z.string().min(1),
  stepIndex: z.number().int().min(1),
  description: z.string().min(2),
  score: z.number().positive(),
  ruleType: z.string().min(2),
  params: z.record(z.string(), z.unknown()),
});

const GeneratedQuestionSchema = z.object({
  title: z.string().min(3),
  knowledgePoints: z.array(z.string()).min(1),
  scenario: z.string().min(10),
  totalScore: z.number().positive().default(100),
  materials: z.object({
    description: z.string(),
    assets: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          note: z.string().optional(),
        })
      )
      .optional(),
    initialState: z.record(z.string(), z.unknown()),
  }),
  steps: z.array(StepSchema).min(2).max(10),
  checkpoints: z.array(CheckpointSchema).min(2),
  referenceAnswer: z.record(z.string(), z.unknown()),
  analysis: z.array(z.string()).min(1),
  commonMistakes: z.array(z.string()).default([]),
  needsImagePrompt: z.string().optional().nullable(),
});

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callChatCompletions(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  cfgOverride?: Partial<LlmConfigRow>,
  options?: { jsonMode?: boolean }
): Promise<{ text: string; latencyMs: number }> {
  const dbCfg = getLlmConfig();
  const baseUrl = (cfgOverride?.base_url || dbCfg.base_url).replace(/\/+$/, '');
  const apiKey = cfgOverride?.api_key || dbCfg.api_key;
  const model = cfgOverride?.text_model || dbCfg.text_model;
  const temperature = cfgOverride?.temperature ?? dbCfg.temperature;
  const maxTokens = options?.jsonMode
    ? Math.max(cfgOverride?.max_tokens ?? dbCfg.max_tokens ?? 4096, 4096)
    : (cfgOverride?.max_tokens ?? dbCfg.max_tokens);
  const timeoutMs = Math.min(
    Math.max(cfgOverride?.timeout_ms ?? dbCfg.timeout_ms ?? 35000, 8000),
    40000
  );

  const sendRequest = async (withJsonFormat: boolean) => {
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (withJsonFormat) {
      payload.response_format = { type: 'json_object' };
    }
    return fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );
  };

  const started = Date.now();
  let resp = await sendRequest(Boolean(options?.jsonMode));
  if (options?.jsonMode && (resp.status === 400 || resp.status === 422)) {
    // Some OpenAI-compatible gateways reject response_format; retry cleanly without it
    resp = await sendRequest(false);
  }

  const latencyMs = Date.now() - started;
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(
        `NON_RETRYABLE:大模型接口鉴权或账号受限（HTTP ${resp.status}），请联系管理员在「后台管理 -> 大模型配置」更换可用接口，或先切换为「会考标准模板快速出题」。`
      );
    }
    if (resp.status === 404) {
      throw new Error(
        `NON_RETRYABLE:大模型接口地址或模型名称无效（HTTP 404），请检查后台大模型配置。`
      );
    }
    if (resp.status === 429) {
      throw new Error(
        `NON_RETRYABLE:大模型接口请求过于频繁或额度不足（HTTP 429），请稍后再试或切换为「会考标准模板快速出题」。`
      );
    }
    throw new Error(
      `HTTP ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`
    );
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('模型返回内容为空');
  }
  return { text, latencyMs };
}

export async function callImageGenerations(
  prompt: string,
  cfgOverride?: Partial<LlmConfigRow>
): Promise<{ localUrl: string; latencyMs: number }> {
  const dbCfg = getLlmConfig();
  const baseUrl = (cfgOverride?.base_url || dbCfg.base_url).replace(/\/+$/, '');
  const apiKey = cfgOverride?.api_key || dbCfg.api_key;
  const model = cfgOverride?.image_model || dbCfg.image_model;
  const timeoutMs = cfgOverride?.timeout_ms ?? dbCfg.timeout_ms;

  const started = Date.now();
  const resp = await fetchWithTimeout(
    `${baseUrl}/images/generations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    },
    timeoutMs
  );

  const latencyMs = Date.now() - started;
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(
      `HTTP ${resp.status} ${resp.statusText}: ${errText.slice(0, 300)}`
    );
  }

  const data = (await resp.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  const item = data.data?.[0];
  if (!item) {
    throw new Error('图片接口未返回 data[0]');
  }

  fs.mkdirSync(APP_CONFIG.uploadsDir, { recursive: true });
  const filename = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
  const destPath = path.join(APP_CONFIG.uploadsDir, filename);

  if (item.b64_json) {
    const buf = Buffer.from(item.b64_json, 'base64');
    fs.writeFileSync(destPath, buf);
    return { localUrl: `/api/uploads/${filename}`, latencyMs };
  }

  if (item.url) {
    const imgResp = await fetchWithTimeout(item.url, {}, 20000);
    if (!imgResp.ok) {
      throw new Error(`下载生成图片失败: HTTP ${imgResp.status}`);
    }
    const arrBuf = await imgResp.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrBuf));
    return { localUrl: `/api/uploads/${filename}`, latencyMs };
  }

  throw new Error('图片接口返回缺少 url 或 b64_json');
}

function buildQuestionPrompt(options: {
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoints?: string[];
  customPrompt?: string;
  stepCount?: number;
  totalScore?: number;
  needsImage?: boolean;
}): string {
  const {
    type,
    difficulty,
    knowledgePoints,
    customPrompt,
    stepCount = 4,
    totalScore = 100,
    needsImage,
  } = options;

  const typeSpecs: Record<QuestionType, string> = {
    word: `题型：Word 文字处理。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "paragraphs": [{ "id": "p1", "text": "...", "fontFamily": "宋体", "fontSize": 12, "color": "#000000", "bold": false, "italic": false, "underline": false, "align": "left", "lineHeight": 1.0, "indent": 0, "listType": "none" }],
  "tables": [{ "id": "t1", "rows": [["表头1","表头2"],["数据1","数据2"]] }],
  "images": [{ "id": "img1", "src": "/api/seed-assets/info-literacy.svg", "alt": "说明", "width": 320, "align": "center" }],
  "headerText": "",
  "footerText": "",
  "pageSetup": { "orientation": "portrait", "marginTop": 2.54, "marginBottom": 2.54, "marginLeft": 3.18, "marginRight": 3.18 }
}
可用的 ruleType 与 params：
- "word_paragraph_style": { "paragraphIndex": 0, "fontFamily": "黑体", "fontSize": 18, "bold": true, "align": "center", "color": "#1D4ED8", "lineHeight": 1.5, "indent": 2, "listType": "bullet" }（仅填需要检查的字段）
- "word_text_contains": { "text": "某文本", "paragraphIndex": 0 }
- "word_text_not_contains": { "text": "被替换掉的旧文本" }
- "word_table_exists": { "minRows": 3, "minCols": 2, "cellChecks": [{ "row": 0, "col": 0, "equals": "名称" }] }
- "word_image_exists": { "minCount": 1, "requireAlt": true }
- "word_header_footer": { "headerContains": "页眉", "footerContains": "页脚" }
- "word_page_setup": { "orientation": "landscape", "marginTop": 2.0, "marginBottom": 2.0 }`,

    excel: `题型：Excel 电子表格。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "cells": { "A1": { "value": "标题", "formula": "", "bold": false, "bgColor": "", "align": "left", "border": false, "numberFormat": "general" } },
  "merges": ["A1:E1"],
  "charts": [{ "id": "c1", "type": "column", "title": "图表标题", "labelRange": "A2:A5", "dataRange": "C2:C5" }],
  "sortInfo": { "column": "E", "order": "desc" },
  "filterInfo": { "column": "B", "keyword": "高一" }
}
支持公式函数：SUM, AVERAGE, MAX, MIN, COUNT, COUNTA, IF, RANK, ROUND, COUNTIF，以及四则运算和 $ 绝对引用。
可用的 ruleType 与 params：
- "excel_cell_formula": { "cell": "E3", "expectedFormula": "=SUM(B3:D3)", "expectedValue": 270 }
- "excel_cell_value": { "cell": "A1", "expectedValue": "成绩统计表" }
- "excel_cell_style": { "range": "A1:E1", "bold": true, "bgColor": "#E0F2FE", "border": true, "align": "center", "numberFormat": "number2|percent|currency" }
- "excel_merge_exists": { "range": "A1:E1" }
- "excel_chart_exists": { "chartType": "column|line|pie", "titleContains": "统计", "dataRange": "C2:C5" }
- "excel_sort_applied": { "column": "E", "order": "desc|asc" }
- "excel_filter_applied": { "column": "B", "keywordContains": "关键词" }`,

    web: `题型：网页制作（HTML/CSS）。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "files": [
    { "path": "index.html", "name": "index.html", "type": "html", "content": "<!DOCTYPE html>..." },
    { "path": "styles.css", "name": "styles.css", "type": "css", "content": "body { ... }" }
  ]
}
可用的 ruleType 与 params：
- "web_file_exists": { "path": "styles.css" }
- "web_html_tag": { "file": "index.html", "tag": "h1", "minCount": 1, "textContains": "标题", "attrs": { "alt": true } }
- "web_css_rule": { "file": "styles.css", "selector": "h1", "property": "text-align", "expectedValue": "center" }
- "web_code_contains": { "file": "index.html", "pattern": "<ul>" }`,

    file: `题型：文件与文件夹管理。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "items": [
    { "id": "root", "path": "D:", "name": "本地磁盘 (D:)", "type": "folder", "parentPath": "" },
    { "id": "f1", "path": "D:/笔记.txt", "name": "笔记.txt", "type": "file", "parentPath": "D:", "content": "内容", "size": 10, "readOnly": false, "hidden": false }
  ]
}
可用的 ruleType 与 params：
- "file_exists": { "path": "D:/作业/报告.txt", "itemType": "file|folder|shortcut", "readOnly": true, "hidden": false, "targetPath": "仅shortcut需要" }
- "file_not_exists": { "path": "D:/旧文件.tmp" }`,

    python: `题型：Python 程序设计（新课标《数据与计算》）。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "code": "# 初始代码模板或完整参考代码\\n",
  "customInput": "示例标准输入内容（无输入可留空字符串）",
  "lastOutput": "",
  "lastError": ""
}
重要约定：不要使用 os/sys/subprocess/open/eval/exec；如使用 input()，括号内不要加中文提示字符串（直接写 input()），以便精确比对 stdout。
可用的 ruleType 与 params：
- "python_syntax_valid": {}（检查语法正确）
- "python_code_contains": { "patterns": ["for ", "if "], "matchAny": false, "isRegex": false }
- "python_test_cases": { "cases": [{ "stdin": "输入样例1", "expectedOutput": "精确期望输出1" }, { "stdin": "输入样例2", "expectedOutput": "精确期望输出2" }] }（至少提供 2 组不同测试用例，确保参考答案全部运行通过！）`,

    database: `题型：数据库与 SQL 查询（基于 SQLite 内存库）。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "tables": [
    { "name": "表名", "columns": ["id", "name", "score"], "rows": [[1, "张三", 92], [2, "李四", 85]] }
  ],
  "sql": "-- 初始注释或完整参考 SQL 语句\\n",
  "lastColumns": [],
  "lastRows": [],
  "lastChanges": 0,
  "lastError": ""
}
注意：referenceAnswer 的 tables 必须与 initialState 的 tables 保持相同初始结构（判分器会在 initialState 的 tables 上重新执行 referenceAnswer.sql 来检查结果或表状态）。
可用的 ruleType 与 params：
- "sql_code_contains": { "patterns": ["SELECT", "WHERE", "ORDER BY"], "isRegex": false }
- "sql_query_result": { "expectedColumns": ["name", "score"], "expectedRows": [["张三", 92]], "ignoreOrder": false }
- "sql_table_state": { "tableName": "表名", "expectedRowCount": 3, "rowContains": [[3, "王五", 88]], "rowNotContains": [] }`,
  };

  const kpLine =
    knowledgePoints && knowledgePoints.length > 0
      ? `重点考查知识点：${knowledgePoints.join('、')}。`
      : '';
  const customLine = customPrompt?.trim()
    ? `教师教学定制要求：${customPrompt.trim()}。`
    : '';
  const imageLine =
    needsImage === true && (type === 'word' || type === 'web')
      ? '本题需要配图：请填写 "needsImagePrompt"（简洁的英文或中文图像描述），并在初始素材与参考答案中使用 "/api/seed-assets/heritage.svg" 作为图片引用占位路径。'
      : needsImage === false
        ? '本题无需配图，请将 "needsImagePrompt" 设为 null。'
        : '如果题目需要配图（如 Word 插图或网页 img 图片），可填写 "needsImagePrompt"，否则设为 null；在没有自定义生成图片前，先用 "/api/seed-assets/heritage.svg" 作为占位路径。';

  return `你是一名中国高中信息技术学业水平考试（会考）命题专家。请严格生成 1 道符合高中会考难度与风格的操作题。
要求：
1. 难度：${difficulty}。${kpLine}${customLine}
2. 步骤数量：${Math.max(3, Math.min(8, stepCount))} 步，每一步任务明确、无歧义、可被程序确定性判定。
3. 所有 checkpoints 的 score 之和必须严格等于 totalScore（${totalScore}）。
4. referenceAnswer 必须与 initialState 同结构，且必须 100% 通过你给出的所有 checkpoints 判分规则。
5. ${typeSpecs[type]}
6. ${imageLine}
7. 必须只输出一个严格合法的 JSON 对象（不要任何额外说明、注释或尾逗号；字符串内部如包含双引号请务必使用反斜杠 \\" 转义或改用单引号/书名号，禁止裸换行符）。JSON 顶层字段为：
title, knowledgePoints, scenario, totalScore(${totalScore}), materials({description, initialState}), steps([{index, instruction, score, hint}]), checkpoints([{id, stepIndex, description, score, ruleType, params}]), referenceAnswer, analysis([string]), commonMistakes([string]), needsImagePrompt。`;
}

function normalizeRawGeneratedQuestion(
  raw: Record<string, unknown>,
  fallbackKps: string[] | undefined,
  requestedTotalScore: number
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  out.title = String(out.title || '信息技术操作综合练习题').trim();
  out.scenario = String(
    out.scenario || '请根据操作任务要求完成以下信息技术应用处理。'
  ).trim();

  const rawKps = Array.isArray(out.knowledgePoints)
    ? out.knowledgePoints.map((k) => String(k).trim()).filter(Boolean)
    : [];
  out.knowledgePoints =
    rawKps.length > 0
      ? rawKps
      : fallbackKps && fallbackKps.length > 0
        ? fallbackKps
        : ['信息技术综合操作'];

  const totalScoreNum = Number(out.totalScore);
  out.totalScore =
    Number.isFinite(totalScoreNum) && totalScoreNum > 0
      ? totalScoreNum
      : requestedTotalScore || 100;

  const rawSteps = Array.isArray(out.steps) ? out.steps : [];
  out.steps = rawSteps.map((s, idx) => {
    const rec = s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
    const stepScore = Number(rec.score);
    return {
      index: Math.max(1, Math.round(Number(rec.index) || idx + 1)),
      instruction: String(
        rec.instruction || rec.description || rec.title || `完成第 ${idx + 1} 步操作`
      ),
      score: Number.isFinite(stepScore) && stepScore > 0 ? stepScore : 20,
      hint: rec.hint ? String(rec.hint) : undefined,
    };
  });

  const rawCps = Array.isArray(out.checkpoints) ? out.checkpoints : [];
  out.checkpoints = rawCps.map((c, idx) => {
    const rec = c && typeof c === 'object' ? (c as Record<string, unknown>) : {};
    const cpScore = Number(rec.score);
    return {
      id: String(rec.id || `cp-${idx + 1}`),
      stepIndex: Math.max(1, Math.round(Number(rec.stepIndex) || idx + 1)),
      description: String(rec.description || `检查点 ${idx + 1}`),
      score: Number.isFinite(cpScore) && cpScore > 0 ? cpScore : 20,
      ruleType: String(rec.ruleType || ''),
      params:
        rec.params && typeof rec.params === 'object' && !Array.isArray(rec.params)
          ? rec.params
          : {},
    };
  });

  const rawMats =
    out.materials && typeof out.materials === 'object' && !Array.isArray(out.materials)
      ? (out.materials as Record<string, unknown>)
      : {};
  out.materials = {
    description: String(rawMats.description || '题目初始操作环境'),
    assets: Array.isArray(rawMats.assets) ? rawMats.assets : undefined,
    initialState:
      rawMats.initialState &&
      typeof rawMats.initialState === 'object' &&
      !Array.isArray(rawMats.initialState)
        ? rawMats.initialState
        : {},
  };

  if (
    !out.referenceAnswer ||
    typeof out.referenceAnswer !== 'object' ||
    Array.isArray(out.referenceAnswer)
  ) {
    out.referenceAnswer = {};
  }

  if (typeof out.analysis === 'string') {
    out.analysis = out.analysis.trim() ? [out.analysis.trim()] : ['按步骤依次完成操作并核对细节。'];
  } else if (!Array.isArray(out.analysis) || out.analysis.length === 0) {
    out.analysis = ['按步骤依次完成操作并核对细节。'];
  } else {
    out.analysis = out.analysis.map((a) => String(a).trim()).filter(Boolean);
    if ((out.analysis as string[]).length === 0) {
      out.analysis = ['按步骤依次完成操作并核对细节。'];
    }
  }

  if (typeof out.commonMistakes === 'string') {
    out.commonMistakes = out.commonMistakes.trim() ? [out.commonMistakes.trim()] : [];
  } else if (Array.isArray(out.commonMistakes)) {
    out.commonMistakes = out.commonMistakes.map((m) => String(m).trim()).filter(Boolean);
  } else {
    out.commonMistakes = [];
  }

  return out;
}

export async function generateQuestionWithAi(params: {
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoint?: string;
  knowledgePoints?: string[];
  knowledgePointIds?: string[];
  customPrompt?: string;
  stepCount?: number;
  totalScore?: number;
  needsImage?: boolean;
  status?: QuestionStatus;
  ownerId?: string;
  visibility?: QuestionVisibility;
}): Promise<Question> {
  const kps =
    params.knowledgePoints && params.knowledgePoints.length > 0
      ? params.knowledgePoints
      : params.knowledgePoint
        ? [params.knowledgePoint]
        : undefined;

  const prompt = buildQuestionPrompt({
    type: params.type,
    difficulty: params.difficulty,
    knowledgePoints: kps,
    customPrompt: params.customPrompt,
    stepCount: params.stepCount,
    totalScore: params.totalScore || 100,
    needsImage: params.needsImage,
  });

  let lastError = '生成失败';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text } = await callChatCompletions(
        [
          {
            role: 'system',
            content:
              '你是高中信息技术会考命题系统后端生成器，只输出严格合法的 JSON 对象，字符串内的引号与换行务必正确转义。',
          },
          {
            role: 'user',
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\n上次生成校验失败（${lastError}），请修正 JSON 格式（确保双引号转义正确）和 referenceAnswer 确保所有 checkpoints 全部通过！`,
          },
        ],
        undefined,
        { jsonMode: true }
      );

      const rawJson = normalizeRawGeneratedQuestion(
        parseLlmJson(text),
        kps,
        params.totalScore || 100
      );
      const parsed = GeneratedQuestionSchema.parse(rawJson);

      const sumScore = parsed.checkpoints.reduce((s, c) => s + c.score, 0);
      if (Math.abs(sumScore - parsed.totalScore) > 0.01) {
        parsed.totalScore = sumScore;
      }

      let generatedImageUrl: string | null = null;
      if (
        (params.needsImage || parsed.needsImagePrompt) &&
        params.needsImage !== false &&
        (params.type === 'word' || params.type === 'web')
      ) {
        try {
          const imgRes = await callImageGenerations(
            parsed.needsImagePrompt ||
              `Clean educational illustration for ${parsed.title}`
          );
          generatedImageUrl = imgRes.localUrl;
        } catch {
          generatedImageUrl = '/api/seed-assets/heritage.svg';
        }
      }

      let materialsJsonStr = JSON.stringify(parsed.materials);
      let refAnswerJsonStr = JSON.stringify(parsed.referenceAnswer);
      if (
        generatedImageUrl &&
        generatedImageUrl !== '/api/seed-assets/heritage.svg'
      ) {
        materialsJsonStr = materialsJsonStr.replaceAll(
          '/api/seed-assets/heritage.svg',
          generatedImageUrl
        );
        refAnswerJsonStr = refAnswerJsonStr.replaceAll(
          '/api/seed-assets/heritage.svg',
          generatedImageUrl
        );
      }

      const finalMaterials = JSON.parse(materialsJsonStr);
      if (generatedImageUrl) {
        finalMaterials.assets = Array.isArray(finalMaterials.assets)
          ? finalMaterials.assets
          : [];
        finalMaterials.assets.push({
          name: '题目配图素材',
          url: generatedImageUrl,
          note: 'AI 生成题目素材图片',
        });
      }
      const rawRefAnswer = JSON.parse(refAnswerJsonStr);
      const ensureState = (raw: Record<string, unknown>) => {
        const s = raw && typeof raw === 'object' ? { ...raw } : {};
        if (params.type === 'word') {
          if (!Array.isArray(s.paragraphs)) s.paragraphs = [];
          if (!Array.isArray(s.tables)) s.tables = [];
          if (!Array.isArray(s.images)) s.images = [];
          if (typeof s.headerText !== 'string') s.headerText = '';
          if (typeof s.footerText !== 'string') s.footerText = '';
          if (!s.pageSetup || typeof s.pageSetup !== 'object') {
            s.pageSetup = {
              orientation: 'portrait',
              marginTop: 2.54,
              marginBottom: 2.54,
              marginLeft: 3.18,
              marginRight: 3.18,
            };
          }
        } else if (params.type === 'excel') {
          if (!s.cells || typeof s.cells !== 'object') s.cells = {};
          if (!Array.isArray(s.merges)) s.merges = [];
          if (!Array.isArray(s.charts)) s.charts = [];
        } else if (params.type === 'web') {
          if (!Array.isArray(s.files)) s.files = [];
        } else if (params.type === 'file') {
          if (!Array.isArray(s.items)) s.items = [];
        } else if (params.type === 'python') {
          s.code = String(s.code || '');
          s.customInput = String(s.customInput || '');
          s.lastOutput = String(s.lastOutput || '');
          s.lastError = String(s.lastError || '');
        } else if (params.type === 'database') {
          if (!Array.isArray(s.tables)) s.tables = [];
          s.sql = String(s.sql || '');
        }
        return s;
      };
      finalMaterials.initialState = ensureState(
        (finalMaterials.initialState as Record<string, unknown>) || {}
      );
      const finalRefAnswer = ensureState(rawRefAnswer);

      const selfCheck = gradeAnswerDeterministic(
        params.type,
        parsed.checkpoints,
        finalRefAnswer as never
      );

      if (selfCheck.autoScore < selfCheck.maxScore) {
        const failedMsgs = selfCheck.checkpointResults
          .filter((c) => !c.passed)
          .map((c) => `${c.description}: ${c.feedback}`)
          .join('; ');
        lastError = `自检未满分(${selfCheck.autoScore}/${selfCheck.maxScore}): ${failedMsgs}`;
        continue;
      }

      const now = new Date().toISOString();
      const question: Question = {
        id: `ai-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: parsed.title,
        type: params.type,
        difficulty: params.difficulty,
        knowledgePoints: kps && kps.length > 0 ? kps : parsed.knowledgePoints,
        knowledgePointIds: params.knowledgePointIds || [],
        scenario: parsed.scenario,
        totalScore: parsed.totalScore,
        materials: finalMaterials,
        steps: parsed.steps,
        checkpoints: parsed.checkpoints,
        referenceAnswer: finalRefAnswer as never,
        analysis: parsed.analysis,
        commonMistakes: parsed.commonMistakes,
        status: params.status || 'published',
        source: 'ai',
        ownerId: params.ownerId || 'system',
        visibility: params.visibility || 'public',
        createdAt: now,
        updatedAt: now,
      };

      return question;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.startsWith('NON_RETRYABLE:')) {
        throw new Error(rawMsg.replace(/^NON_RETRYABLE:/, ''));
      }
      lastError = rawMsg;
    }
  }

  throw new Error(`AI 出题失败（已重试 3 次）：${lastError}`);
}

export async function regenerateQuestionAnswer(
  question: Question
): Promise<{
  referenceAnswer: Question['referenceAnswer'];
  analysis: string[];
  commonMistakes: string[];
}> {
  const prompt = `给定以下高中信息技术操作题，请重新生成能 100% 通过所有 checkpoints 判分规则的 referenceAnswer、分步解析 analysis 以及常见错误提醒 commonMistakes。
题目：${question.title}
题型：${question.type}
情境：${question.scenario}
初始状态 initialState：${JSON.stringify(question.materials.initialState)}
分步任务：${JSON.stringify(question.steps)}
判分规则 checkpoints：${JSON.stringify(question.checkpoints)}

只输出严格 JSON：{ "referenceAnswer": {...}, "analysis": ["..."], "commonMistakes": ["..."] }`;

  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text } = await callChatCompletions(
        [
          { role: 'system', content: '只输出合法 JSON 对象。' },
          { role: 'user', content: prompt },
        ],
        undefined,
        { jsonMode: true }
      );
      const parsed = parseLlmJson(text) as {
        referenceAnswer?: Question['referenceAnswer'];
        analysis?: unknown;
        commonMistakes?: unknown;
      };
      if (!parsed.referenceAnswer || typeof parsed.referenceAnswer !== 'object') {
        lastErr = '返回缺少 referenceAnswer 对象';
        continue;
      }
      const check = gradeAnswerDeterministic(
        question.type,
        question.checkpoints,
        parsed.referenceAnswer
      );
      if (check.autoScore < check.maxScore) {
        lastErr = `自检未满分(${check.autoScore}/${check.maxScore})`;
        continue;
      }
      return {
        referenceAnswer: parsed.referenceAnswer,
        analysis: Array.isArray(parsed.analysis) ? parsed.analysis : [],
        commonMistakes: Array.isArray(parsed.commonMistakes)
          ? parsed.commonMistakes
          : [],
      };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`重新生成参考答案失败：${lastErr}`);
}
