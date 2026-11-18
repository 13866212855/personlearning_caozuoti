import { Router } from 'express';
import { getDb } from '../db';
import { type AuthedRequest, requirePortalAuth } from '../middleware/auth';

const router = Router();
router.use(requirePortalAuth);

router.get('/', (req: AuthedRequest, res) => {
  const db = getDb();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 15)));
  const userId = req.user!.id;

  const totalRow = db
    .prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?')
    .get(userId) as { cnt: number };

  const unreadRow = db
    .prepare(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0'
    )
    .get(userId) as { cnt: number };

  const rows = db
    .prepare(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId, pageSize, (page - 1) * pageSize) as Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    link: string;
    is_read: number;
    created_at: string;
  }>;

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      link: r.link,
      isRead: Boolean(r.is_read),
      createdAt: r.created_at,
    })),
    total: totalRow.cnt,
    unreadCount: unreadRow.cnt,
    page,
    pageSize,
  });
});

router.post('/read-all', (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(
    req.user!.id
  );
  res.json({ ok: true });
});

router.post('/:id/read', (req: AuthedRequest, res) => {
  const db = getDb();
  db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(String(req.params.id), req.user!.id);
  res.json({ ok: true });
});

export default router;
