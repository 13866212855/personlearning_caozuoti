import { Router } from 'express';
import { requireStudentAuth } from '../middleware/auth';

const router = Router();
router.use(requireStudentAuth);

// Practice Center has been removed from student portal per curriculum workflow update.
router.all(/.*/, (_req, res) => {
  res.status(403).json({
    error: '学生端自由练习中心已关闭，请通过「模拟考试」或「错题本」进行练习',
  });
});

export default router;
