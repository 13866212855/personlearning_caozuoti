import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { APP_CONFIG } from './config';
import { getDb } from './db';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examRoutes from './routes/exams';
import profileRoutes from './routes/profile';
import teacherRoutes from './routes/teacher';
import notificationRoutes from './routes/notifications';
import adminRoutes from './routes/admin';

export function createExpressApiApp() {
  // Initialize SQLite database & default records on startup
  getDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  // Serve generated/uploaded images safely
  app.get('/api/uploads/:filename', (req, res) => {
    const safeName = path.basename(String(req.params.filename));
    const fullPath = path.join(APP_CONFIG.uploadsDir, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: '图片不存在' });
      return;
    }
    res.sendFile(fullPath);
  });

  // Built-in crisp SVG seed assets for offline/demo Word & Web questions
  app.get('/api/seed-assets/:name', (req, res) => {
    const name = req.params.name;
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    if (name === 'info-literacy.svg') {
      res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240">
        <rect width="480" height="240" rx="12" fill="#F0F9FF"/>
        <rect x="24" y="24" width="130" height="80" rx="8" fill="#0284C7"/>
        <text x="89" y="69" text-anchor="middle" fill="#FFFFFF" font-size="15" font-family="sans-serif">信息意识</text>
        <rect x="175" y="24" width="130" height="80" rx="8" fill="#0D9488"/>
        <text x="240" y="69" text-anchor="middle" fill="#FFFFFF" font-size="15" font-family="sans-serif">计算思维</text>
        <rect x="326" y="24" width="130" height="80" rx="8" fill="#0369A1"/>
        <text x="391" y="69" text-anchor="middle" fill="#FFFFFF" font-size="15" font-family="sans-serif">数字化学习</text>
        <rect x="120" y="136" width="240" height="72" rx="8" fill="#FFFFFF" stroke="#0284C7" stroke-width="2"/>
        <text x="240" y="177" text-anchor="middle" fill="#0F172A" font-size="16" font-weight="bold" font-family="sans-serif">信息社会责任与安全</text>
      </svg>`);
      return;
    }
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240">
      <rect width="480" height="240" rx="12" fill="#F0FDFA"/>
      <circle cx="240" cy="120" r="76" fill="none" stroke="#0F766E" stroke-width="4"/>
      <polygon points="240,60 256,104 302,104 265,132 278,176 240,150 202,176 215,132 178,104 224,104" fill="#0D9488"/>
      <text x="240" y="220" text-anchor="middle" fill="#134E4A" font-size="14" font-family="sans-serif">中国传统非遗剪纸文化示例图</text>
    </svg>`);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      authMode: APP_CONFIG.platform.authMode,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  return app;
}
