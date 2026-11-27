import { execFileSync } from 'node:child_process';

export interface PythonSyntaxResult {
  valid: boolean;
  error?: string;
  blockedReason?: string;
}

export interface PythonRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  blockedReason?: string;
}

export interface PythonTestCase {
  stdin?: string;
  expectedOutput?: string;
  contains?: string;
}

export interface PythonTestCaseOutcome {
  index: number;
  passed: boolean;
  actualOutput: string;
  expectedOutput?: string;
  error?: string;
}

export interface PythonTestSuiteResult {
  ok: boolean;
  blockedReason?: string;
  error?: string;
  results: PythonTestCaseOutcome[];
}

const MAX_CODE_LENGTH = 12000;
const MAX_STDIN_LENGTH = 4000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\bimport\s+(?:os|sys|subprocess|shutil|socket|urllib|http|pathlib|ctypes|importlib|multiprocessing|threading|pickle|marshal|signal|pty|fcntl|tempfile|glob|asyncio|ssl|ftplib|smtplib|builtins|codecs|inspect|gc)\b/,
    reason: '教学沙盒禁止导入系统、文件、网络或进程相关模块',
  },
  {
    pattern:
      /\bfrom\s+(?:os|sys|subprocess|shutil|socket|urllib|http|pathlib|ctypes|importlib|multiprocessing|threading|pickle|marshal|signal|pty|fcntl|tempfile|glob|asyncio|ssl|ftplib|smtplib|builtins|codecs|inspect|gc)\b/,
    reason: '教学沙盒禁止导入系统、文件、网络或进程相关模块',
  },
  {
    pattern: /\b__import__\s*\(/,
    reason: '教学沙盒禁止使用 __import__ 动态导入',
  },
  {
    pattern: /\b(open|eval|exec|compile|breakpoint)\s*\(/,
    reason: '教学沙盒禁止调用 open / eval / exec / compile / breakpoint',
  },
  {
    pattern:
      /(__builtins__|__subclasses__|__globals__|__code__|__class__|__loader__|__spec__|__dict__|__mro__|__bases__)/,
    reason: '教学沙盒禁止访问 Python 底层内部属性',
  },
];

export function validatePythonSafety(code: string): string | null {
  if (typeof code !== 'string') {
    return '代码内容必须是字符串';
  }
  if (code.length > MAX_CODE_LENGTH) {
    return `代码长度不能超过 ${MAX_CODE_LENGTH} 个字符`;
  }
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(code)) {
      return rule.reason;
    }
  }
  return null;
}

const PYTHON_SYNTAX_SCRIPT = `
import ast, json, sys
code = sys.argv[1]
try:
    ast.parse(code)
    print(json.dumps({"valid": True}))
except SyntaxError as e:
    msg = f"第 {e.lineno} 行语法错误: {e.msg}" if e.lineno else str(e)
    print(json.dumps({"valid": False, "error": msg}))
`;

const PYTHON_RUN_HARNESS = `
import builtins, contextlib, io, json, sys, traceback

ALLOWED_MODULES = {
    "math", "random", "statistics", "datetime", "time",
    "collections", "itertools", "functools", "re", "string",
    "decimal", "fractions", "json", "copy", "bisect", "heapq",
    "operator", "typing"
}
BLOCKED_BUILTINS = {
    "open", "eval", "exec", "compile", "__import__",
    "breakpoint", "memoryview", "globals", "locals", "vars"
}

_raw_import = builtins.__import__
def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = str(name or "").split(".")[0]
    if root not in ALLOWED_MODULES:
        raise ImportError(f"教学沙盒不支持导入模块: {name}")
    return _raw_import(name, globals, locals, fromlist, level)

SAFE_BUILTINS = {
    k: v for k, v in vars(builtins).items() if k not in BLOCKED_BUILTINS
}
SAFE_BUILTINS["__import__"] = _safe_import

payload = json.loads(sys.argv[1])
code = payload.get("code", "")
cases = payload.get("cases", [])

results = []
for idx, tc in enumerate(cases):
    stdin_text = str(tc.get("stdin", "") or "")
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    old_stdin = sys.stdin
    sys.stdin = io.StringIO(stdin_text)
    env = {"__name__": "__main__", "__builtins__": SAFE_BUILTINS}
    err_msg = ""
    try:
        compiled = compile(code, "<student_code>", "exec")
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            exec(compiled, env)
    except SystemExit:
        pass
    except BaseException as exc:
        tb_lines = traceback.format_exception_only(type(exc), exc)
        err_msg = "".join(tb_lines).strip()
    finally:
        sys.stdin = old_stdin

    out_str = stdout_buf.getvalue()
    err_out = stderr_buf.getvalue().strip()
    combined_err = "\\n".join([x for x in [err_out, err_msg] if x])
    results.append({
        "index": idx,
        "stdout": out_str[:16384],
        "stderr": combined_err[:4096],
    })

print(json.dumps({"results": results}, ensure_ascii=False))
`;

function buildSafeEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: process.env.NODE_ENV || 'production',
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    PYTHONIOENCODING: 'utf-8',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
  };
}

export function checkPythonSyntax(code: string): PythonSyntaxResult {
  const blocked = validatePythonSafety(code);
  if (blocked) {
    return { valid: false, blockedReason: blocked, error: blocked };
  }
  if (!code.trim()) {
    return { valid: false, error: '代码不能为空' };
  }
  try {
    const raw = execFileSync('python3', ['-I', '-c', PYTHON_SYNTAX_SCRIPT, code], {
      timeout: 1500,
      maxBuffer: 64 * 1024,
      encoding: 'utf8',
      env: buildSafeEnv(),
    });
    const parsed = JSON.parse(raw.trim()) as { valid: boolean; error?: string };
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `语法检查失败：${message.slice(0, 200)}` };
  }
}

export function runPythonCode(
  code: string,
  customInput = ''
): PythonRunResult {
  const blocked = validatePythonSafety(code);
  if (blocked) {
    return {
      ok: false,
      stdout: '',
      stderr: blocked,
      durationMs: 0,
      blockedReason: blocked,
    };
  }
  const safeInput = String(customInput || '').slice(0, MAX_STDIN_LENGTH);
  const started = Date.now();
  try {
    const raw = execFileSync(
      'python3',
      [
        '-I',
        '-c',
        PYTHON_RUN_HARNESS,
        JSON.stringify({ code, cases: [{ stdin: safeInput }] }),
      ],
      {
        timeout: 2200,
        maxBuffer: 192 * 1024,
        encoding: 'utf8',
        env: buildSafeEnv(),
      }
    );
    const parsed = JSON.parse(raw.trim()) as {
      results?: Array<{ stdout: string; stderr: string }>;
    };
    const first = parsed.results?.[0] || { stdout: '', stderr: '' };
    return {
      ok: !first.stderr,
      stdout: first.stdout || '',
      stderr: first.stderr || '',
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /ETIMEDOUT|timed out/i.test(msg);
    return {
      ok: false,
      stdout: '',
      stderr: isTimeout
        ? '程序运行超时（超过 2 秒），请检查是否存在死循环（如 while 条件未更新）'
        : `运行出错：${msg.slice(0, 240)}`,
      durationMs: Date.now() - started,
    };
  }
}

function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

export function runPythonTestCases(
  code: string,
  cases: PythonTestCase[]
): PythonTestSuiteResult {
  const blocked = validatePythonSafety(code);
  if (blocked) {
    return { ok: false, blockedReason: blocked, error: blocked, results: [] };
  }
  if (!code.trim()) {
    return { ok: false, error: '未编写 Python 代码', results: [] };
  }

  try {
    const raw = execFileSync(
      'python3',
      [
        '-I',
        '-c',
        PYTHON_RUN_HARNESS,
        JSON.stringify({
          code,
          cases: cases.map((c) => ({
            stdin: String(c.stdin || '').slice(0, MAX_STDIN_LENGTH),
          })),
        }),
      ],
      {
        timeout: 2500,
        maxBuffer: 256 * 1024,
        encoding: 'utf8',
        env: buildSafeEnv(),
      }
    );
    const parsed = JSON.parse(raw.trim()) as {
      results?: Array<{ index: number; stdout: string; stderr: string }>;
    };
    const rawResults = parsed.results || [];
    const outcomes: PythonTestCaseOutcome[] = cases.map((tc, idx) => {
      const r = rawResults[idx] || { stdout: '', stderr: '未返回执行结果' };
      if (r.stderr) {
        return {
          index: idx,
          passed: false,
          actualOutput: r.stdout,
          expectedOutput: tc.expectedOutput,
          error: r.stderr,
        };
      }
      const normActual = normalizeOutput(r.stdout);
      let passed = true;
      if (tc.expectedOutput !== undefined) {
        passed = normActual === normalizeOutput(String(tc.expectedOutput));
      } else if (tc.contains !== undefined) {
        passed = normActual.includes(String(tc.contains).trim());
      }
      return {
        index: idx,
        passed,
        actualOutput: normActual,
        expectedOutput: tc.expectedOutput,
      };
    });

    return {
      ok: outcomes.every((o) => o.passed),
      results: outcomes,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /ETIMEDOUT|timed out/i.test(msg);
    return {
      ok: false,
      error: isTimeout
        ? '程序运行超时（超过 2.5 秒），请检查循环退出条件'
        : `测试执行失败：${msg.slice(0, 200)}`,
      results: [],
    };
  }
}
