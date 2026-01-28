import { Router } from 'express';
import { requireAuth } from '../auth/middleware';

const router = Router();

// All order routes require authentication
router.use(requireAuth);

router.get('/orders', async (req, res) => {
  // Get user's orders
  const userId = req.user?.id;
  res.json({ orders: [], userId });
});

router.get('/orders/:id', async (req, res) => {
  const orderId = req.params.id;
  // TODO: Verify order belongs to user
  res.json({ order: { id: orderId, status: 'pending', items: [] } });
});

router.post('/orders', async (req, res) => {
  const { items, shippingAddress } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  // Calculate total
  const total = items.reduce((sum: number, item: any) => {
    return sum + (item.price * item.quantity);
  }, 0);

  res.status(201).json({
    order: {
      id: 1,
      userId: req.user?.id,
      status: 'pending',
      total,
      shippingAddress,
      items,
    },
  });
});

router.patch('/orders/:id/cancel', async (req, res) => {
  const orderId = req.params.id;
  // TODO: Verify order belongs to user and can be cancelled
  res.json({ order: { id: orderId, status: 'cancelled' } });
});

export default router;
