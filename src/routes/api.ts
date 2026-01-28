import { Router } from 'express';
import { requireAuth } from '../auth/middleware';

const router = Router();

router.get('/users', requireAuth, async (req, res) => {
  res.json({ users: [] });
});

router.post('/users', requireAuth, async (req, res) => {
  res.json({ user: req.body });
});

router.delete('/users/:id', requireAuth, async (req, res) => {
  res.json({ deleted: true });
});

export default router;
