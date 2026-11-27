import next from 'next';
import { parse } from 'node:url';
import { APP_CONFIG } from './backend/config';
import { createExpressApiApp } from './backend/app';

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, hostname: '0.0.0.0', port: APP_CONFIG.port });
const handle = nextApp.getRequestHandler();

nextApp
  .prepare()
  .then(() => {
    const server = createExpressApiApp();

    // Express 5 wildcard regex for forwarding all non-API routes to Next.js
    server.all(/.*/, (req, res) => {
      if (dev && req.method === 'GET' && !req.url?.startsWith('/_next/')) {
        res.setHeader('Cache-Control', 'no-store');
      }
      const parsedUrl = parse(req.url || '/', true);
      return handle(req, res, parsedUrl);
    });

    server.listen(APP_CONFIG.port, () => {
      console.log(
        `Server listening on http://localhost:${APP_CONFIG.port} (${dev ? 'dev' : 'production'})`
      );
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
