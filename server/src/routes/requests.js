import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const include = {
  item: { select: { id: true, title: true, mode: true, price: true } },
  requester: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true } }
};

router.get('/', async (req, res, next) => {
  try {
    const [sent, received] = await Promise.all([
      prisma.request.findMany({ where: { requesterId: req.user.sub }, include, orderBy: { createdAt: 'desc' } }),
      prisma.request.findMany({ where: { ownerId: req.user.sub }, include, orderBy: { createdAt: 'desc' } })
    ]);
    res.json({ sent, received });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = z.object({ itemId: z.string().min(1), message: z.string().max(300).optional(), dueDate: z.string().datetime().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request details.' });
    const item = await prisma.item.findUnique({ where: { id: parsed.data.itemId } });
    if (!item || item.status !== 'AVAILABLE') return res.status(404).json({ error: 'This item is no longer available.' });
    if (item.ownerId === req.user.sub) return res.status(400).json({ error: 'You cannot request your own listing.' });
    const request = await prisma.request.create({
      data: {
        itemId: item.id, requesterId: req.user.sub, ownerId: item.ownerId, type: item.mode,
        message: parsed.data.message, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined
      }, include
    });
    res.status(201).json({ request });
  } catch (error) { next(error); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['APPROVED','REJECTED','CANCELLED','COMPLETED']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid status.' });
    const request = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    const isOwner = request.ownerId === req.user.sub;
    const isRequester = request.requesterId === req.user.sub;
    if (!isOwner && !isRequester) return res.status(403).json({ error: 'You cannot change this request.' });
    const status = parsed.data.status;
    if (['APPROVED','REJECTED','COMPLETED'].includes(status) && !isOwner) return res.status(403).json({ error: 'Only the item owner can perform this action.' });
    if (status === 'CANCELLED' && !isRequester) return res.status(403).json({ error: 'Only the requester can cancel this request.' });
    if (request.status !== 'PENDING' && status !== 'COMPLETED') return res.status(409).json({ error: 'This request has already been processed.' });

    const updated = await prisma.$transaction(async tx => {
      if (status === 'APPROVED') {
        const changed = await tx.item.updateMany({ where: { id: request.itemId, status: 'AVAILABLE' }, data: { status: 'RESERVED' } });
        if (changed.count !== 1) throw Object.assign(new Error('This listing is no longer available.'), { status: 409 });
      }
      const result = await tx.request.update({ where: { id: request.id }, data: { status }, include });
      if (status === 'REJECTED' || status === 'CANCELLED') {
        const approved = await tx.request.count({ where: { itemId: request.itemId, status: 'APPROVED' } });
        if (approved === 0) await tx.item.updateMany({ where: { id: request.itemId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
      }
      if (status === 'COMPLETED') {
        await tx.item.update({ where: { id: request.itemId }, data: { status: request.type === 'BORROW' ? 'AVAILABLE' : 'COMPLETED' } });
      }
      return result;
    });
    res.json({ request: updated });
  } catch (error) { next(error); }
});
export default router;
