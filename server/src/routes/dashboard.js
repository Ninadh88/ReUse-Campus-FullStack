import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [totalListings, availableItems, myListings, pendingRequests, byMode] = await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: 'AVAILABLE' } }),
      prisma.item.count({ where: { ownerId: req.user.sub } }),
      prisma.request.count({ where: { OR: [{ ownerId: req.user.sub }, { requesterId: req.user.sub }], status: 'PENDING' } }),
      prisma.item.groupBy({ by: ['mode'], _count: { _all: true } })
    ]);
    res.json({ totalListings, availableItems, myListings, pendingRequests, byMode: byMode.map(row => ({ mode: row.mode, count: row._count._all })) });
  } catch (error) { next(error); }
});
export default router;
