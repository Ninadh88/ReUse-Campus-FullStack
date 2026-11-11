import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(here, '../../uploads');
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage, limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
  }
});
const include = { owner: { select: { id: true, name: true } } };
const schema = z.object({
  title: z.string().trim().min(3).max(90),
  description: z.string().trim().min(5).max(600),
  category: z.string().trim().min(2).max(50),
  mode: z.enum(['SELL','EXCHANGE','DONATE','BORROW']),
  price: z.coerce.number().int().min(0).max(1000000).default(0),
  condition: z.enum(['LIKE_NEW','GOOD','USED','NEEDS_REPAIR']).default('GOOD'),
  location: z.string().max(100).optional()
});

router.get('/', async (req, res, next) => {
  try {
    const { q, category, mode, sort='recent' } = req.query;
    const where = { status: 'AVAILABLE' };
    if (category && category !== 'All items') where.category = String(category);
    if (mode && mode !== 'All ways to reuse') where.mode = String(mode).toUpperCase();
    if (q) where.OR = [
      { title: { contains: String(q), mode: 'insensitive' } },
      { description: { contains: String(q), mode: 'insensitive' } },
      { category: { contains: String(q), mode: 'insensitive' } }
    ];
    const orderBy = sort === 'price-low' ? { price: 'asc' } : sort === 'price-high' ? { price: 'desc' } : { createdAt: 'desc' };
    const items = await prisma.item.findMany({ where, include, orderBy, take: 100 });
    res.json({ items });
  } catch (error) { next(error); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.item.findMany({ where: { ownerId: req.user.sub }, include, orderBy: { createdAt: 'desc' } });
    res.json({ items });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const data = parsed.data;
    const item = await prisma.item.create({
      data: { ...data, price: data.mode === 'SELL' ? data.price : 0, ownerId: req.user.sub, imageUrl: req.file ? `/uploads/${req.file.filename}` : null },
      include
    });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id }, include });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ item });
  } catch (error) { next(error); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Item not found.' });
    if (current.ownerId !== req.user.sub) return res.status(403).json({ error: 'Only the owner can edit this listing.' });
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const item = await prisma.item.update({ where: { id: req.params.id }, data: parsed.data, include });
    res.json({ item });
  } catch (error) { next(error); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Item not found.' });
    if (current.ownerId !== req.user.sub) return res.status(403).json({ error: 'Only the owner can remove this listing.' });
    await prisma.item.delete({ where: { id: req.params.id } });
    res.json({ message: 'Listing deleted.' });
  } catch (error) { next(error); }
});
export default router;
