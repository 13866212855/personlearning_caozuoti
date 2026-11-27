import express from 'express';
import { z } from 'zod';
import { requireAnyUserAuth } from '../middleware/auth';
import { runPythonCode } from '../utils/pythonRunner';
import { runSqlInMemory } from '../utils/sqlRunner';
import type { DatabaseTable } from '../types';

const router = express.Router();

router.use(requireAnyUserAuth);

const pythonRunSchema = z.object({
  code: z.string().max(12000),
  customInput: z.string().max(4000).optional().default(''),
});

router.post('/python', (req, res) => {
  const parsed = pythonRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '代码参数格式无效' });
    return;
  }
  const result = runPythonCode(parsed.data.code, parsed.data.customInput);
  res.json(result);
});

const tableSchema = z.object({
  name: z.string().min(1).max(80),
  columns: z.array(z.string().min(1).max(80)).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

const sqlRunSchema = z.object({
  tables: z.array(tableSchema),
  sql: z.string().max(8000),
});

router.post('/sql', (req, res) => {
  const parsed = sqlRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'SQL 执行参数格式无效' });
    return;
  }
  const result = runSqlInMemory(
    parsed.data.tables as DatabaseTable[],
    parsed.data.sql
  );
  res.json(result);
});

export default router;
