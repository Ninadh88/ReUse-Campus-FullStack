import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash('DemoPass123!', 12);
  const demoUsers = [
    ['Aarav Mehta', 'aarav.demo@srmist.edu.in'],
    ['Diya Rao', 'diya.demo@srmist.edu.in'],
    ['Karthik Sharma', 'karthik.demo@srmist.edu.in'],
    ['Meera Patel', 'meera.demo@srmist.edu.in']
  ];
  const users = [];
  for (const [name, email] of demoUsers) {
    users.push(await prisma.user.upsert({ where: { email }, update: {}, create: { name, email, passwordHash } }));
  }
  if (await prisma.item.count() === 0) {
    const entries = [
      ['Engineering Mathematics — Vol. 1','Clean pages, no missing content. Helpful for first-year engineering mathematics.','Books','SELL',280,'GOOD'],
      ['Casio fx-991EX Scientific Calculator','Works perfectly. Available to borrow for a short period.','Electronics','BORROW',0,'LIKE_NEW'],
      ['Wooden Study Lamp','Warm light, compact size and ideal for a hostel study table.','Hostel essentials','SELL',450,'GOOD'],
      ['Java Programming — Herbert Schildt','A few pencil marks, otherwise completely usable.','Books','DONATE',0,'USED'],
      ['Desk organiser set','Looking to exchange for a notebook stand or desk accessory.','Stationery','EXCHANGE',0,'GOOD'],
      ['USB-C Hub · 6-in-1','HDMI, USB and card-reader ports. Tested and working.','Electronics','SELL',650,'LIKE_NEW']
    ];
    for (let i = 0; i < entries.length; i++) {
      const [title, description, category, mode, price, condition] = entries[i];
      await prisma.item.create({ data: { title, description, category, mode, price, condition, ownerId: users[i % users.length].id, location: 'SRM AP Campus' } });
    }
  }
  console.log('Seed complete. Demo login: aarav.demo@srmist.edu.in / DemoPass123!');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
