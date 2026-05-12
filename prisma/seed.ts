import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // TenantSettings (fila única)
  await prisma.tenantSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // Usuario OWNER inicial
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@reservo.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin1234';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name: 'Administrador',
        role: 'OWNER',
        passwordHash,
      },
    });
    console.log(`✅  Usuario admin creado: ${email} / ${password}`);
  } else {
    console.log(`ℹ️   Usuario admin ya existe: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
