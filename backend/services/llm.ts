import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { APP_CONFIG } from '../config';
import { getDb } from '../db';
import { gradeAnswerDeterministic } from '../grader';
import type {
  DifficultyLevel,
  Question,
  QuestionStatus,
  QuestionType,
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
  updated_at: string;
}

export function getLlmConfig(): LlmConfigRow {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM llm_configs WHERE id = 1')
    .get() as LlmConfigRow;
  return row;
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
  steps: z.array(StepSchema).min(3).max(8),
  checkpoints: z.array(CheckpointSchema).min(3),
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
  cfgOverride?: Partial<LlmConfigRow>
): Promise<{ text: string; latencyMs: number }> {
  const dbCfg = getLlmConfig();
  const baseUrl = (cfgOverride?.base_url || dbCfg.base_url).replace(/\/+$/, '');
  const apiKey = cfgOverride?.api_key || dbCfg.api_key;
  const model = cfgOverride?.text_model || dbCfg.text_model;
  const temperature = cfgOverride?.temperature ?? dbCfg.temperature;
  const maxTokens = cfgOverride?.max_tokens ?? dbCfg.max_tokens;
  const timeoutMs = cfgOverride?.timeout_ms ?? dbCfg.timeout_ms;

  const started = Date.now();
  const resp = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
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

function buildQuestionPrompt(
  type: QuestionType,
  difficulty: DifficultyLevel,
  knowledgePoint?: string
): string {
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
  "cells": { "A1": { "value": "标题", "formula": "", "bold": false, "bgColor": "", "align": "left", "border": false } },
  "merges": ["A1:E1"],
  "charts": [{ "id": "c1", "type": "column", "title": "图表标题", "labelRange": "A2:A5", "dataRange": "C2:C5" }],
  "sortInfo": { "column": "E", "order": "desc" }
}
支持公式函数：SUM, AVERAGE, MAX, MIN, COUNT, IF, RANK, COUNTIF。
可用的 ruleType 与 params：
- "excel_cell_formula": { "cell": "E3", "expectedFormula": "=SUM(B3:D3)", "expectedValue": 270 }
- "excel_cell_style": { "range": "A1:E1", "bold": true, "bgColor": "#E0F2FE", "border": true, "align": "center" }
- "excel_merge_exists": { "range": "A1:E1" }
- "excel_chart_exists": { "chartType": "column", "titleContains": "统计", "dataRange": "C2:C5" }
- "excel_sort_applied": { "column": "E", "order": "desc" }`,

    web: `题型：网页制作（HTML/CSS）。
initialState 与 referenceAnswer 的 JSON 结构必须严格为：
{
  "files": [
    { "path": "index.html", "name": "index.html", "type": "html", "content": "<!DOCTYPE html>..." },
    { "path": "styles.css", "name": "styles.css", "type": "css", "content": "body { ... }" }
  ]
}
可用的 ruleType 与 params：
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
- "file_exists": { "path": "D:/作业/报告.txt", "itemType": "file", "readOnly": true, "hidden": false, "targetPath": "仅shortcut需要" }
- "file_not_exists": { "path": "D:/旧文件.tmp" }`,
  };

  return `你是一名中国高中信息技术学业水平考试（会考）命题专家。请严格生成 1 道符合高中会考难度与风格的操作题。
要求：
1. 难度：${difficulty}。${knowledgePoint ? `重点考查知识点：${knowledgePoint}。` : ''}
2. 步骤数量：3~6 步，每一步任务明确、无歧义、可被程序确定性判定。
3. 所有 checkpoints 的 score 之和必须严格等于 totalScore（100）。
4. referenceAnswer 必须与 initialState 同结构，且必须 100% 通过你给出的所有 checkpoints 判分规则。
5. ${typeSpecs[type]}
6. 如果题目需要配图（如 Word 插图或网页 img 图片），可填写 "needsImagePrompt"（英文或中文绘画描述），否则设为 null；在没有自定义生成图片前，先用 "/api/seed-assets/heritage.svg" 作为占位路径。
7. 必须只输出一个合法 JSON 对象，不要输出任何额外说明或 markdown 以外的内容。JSON 顶层字段为：
title, knowledgePoints, scenario, totalScore(100), materials({description, initialState}), steps([{index, instruction, score, hint}]), checkpoints([{id, stepIndex, description, score, ruleType, params}]), referenceAnswer, analysis([string]), commonMistakes([string]), needsImagePrompt。`;
}

export async function generateQuestionWithAi(params: {
  type: QuestionType;
  difficulty: DifficultyLevel;
  knowledgePoint?: string;
  status?: QuestionStatus;
}): Promise<Question> {
  const prompt = buildQuestionPrompt(
    params.type,
    params.difficulty,
    params.knowledgePoint
  );

  let lastError = '生成失败';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text } = await callChatCompletions([
        {
          role: 'system',
          content:
            '你是高中信息技术会考命题系统后端生成器，只输出严格合法的 JSON 对象。',
        },
        {
          role: 'user',
          content:
            attempt === 1
              ? prompt
              : `${prompt}\n\n上次生成校验失败（${lastError}），请修正 JSON 结构和 referenceAnswer 确保所有 checkpoints 全部通过！`,
        },
      ]);

      const rawJson = JSON.parse(extractJsonBlock(text));
      const parsed = GeneratedQuestionSchema.parse(rawJson);

      // Normalize total score
      const sumScore = parsed.checkpoints.reduce((s, c) => s + c.score, 0);
      if (Math.abs(sumScore - parsed.totalScore) > 0.01) {
        parsed.totalScore = sumScore;
      }

      // Optional image generation if requested for word or web
      let generatedImageUrl: string | null = null;
      if (
        parsed.needsImagePrompt &&
        (params.type === 'word' || params.type === 'web')
      ) {
        try {
          const imgRes = await callImageGenerations(parsed.needsImagePrompt);
          generatedImageUrl = imgRes.localUrl;
        } catch {
          // Graceful fallback if image API unavailable
          generatedImageUrl = '/api/seed-assets/heritage.svg';
        }
      }

      // Replace placeholder image path if an image was generated
      let materialsJsonStr = JSON.stringify(parsed.materials);
      let refAnswerJsonStr = JSON.stringify(parsed.referenceAnswer);
      if (generatedImageUrl && generatedImageUrl !== '/api/seed-assets/heritage.svg') {
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
        finalMaterials.assets = finalMaterials.assets || [];
        finalMaterials.assets.push({
          name: '题目配图素材',
          url: generatedImageUrl,
          note: 'AI 生成题目素材图片',
        });
      }
      const finalRefAnswer = JSON.parse(refAnswerJsonStr);

      // Self-check: Reference Answer MUST score full marks!
      const selfCheck = gradeAnswerDeterministic(
        params.type,
        parsed.checkpoints,
        finalRefAnswer
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
        knowledgePoints: parsed.knowledgePoints,
        scenario: parsed.scenario,
        totalScore: parsed.totalScore,
        materials: finalMaterials,
        steps: parsed.steps,
        checkpoints: parsed.checkpoints,
        referenceAnswer: finalRefAnswer,
        analysis: parsed.analysis,
        commonMistakes: parsed.commonMistakes,
        status: params.status || 'published',
        source: 'ai',
        createdAt: now,
        updatedAt: now,
      };

      return question;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
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
      const { text } = await callChatCompletions([
        { role: 'system', content: '只输出合法 JSON 对象。' },
        { role: 'user', content: prompt },
      ]);
      const parsed = JSON.parse(extractJsonBlock(text));
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
