import { Router } from 'express';
import { requireAuth, hasPermission } from '../auth/middleware';

const router = Router();

router.get('/products', async (req, res) => {
  // Public endpoint - no auth required
  res.json({ products: [] });
});

router.get('/products/:id', async (req, res) => {
  res.json({ product: { id: req.params.id, name: 'Sample Product' } });
});

router.post('/products', requireAuth, hasPermission('products:write'), async (req, res) => {
  const { name, price, description } = req.body;
  res.status(201).json({ product: { id: 1, name, price, description } });
});

router.put('/products/:id', requireAuth, hasPermission('products:write'), async (req, res) => {
  res.json({ product: { id: req.params.id, ...req.body } });
});

router.delete('/products/:id', requireAuth, hasPermission('products:delete'), async (req, res) => {
  res.status(204).send();
});

export default router;
