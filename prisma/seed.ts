const bcrypt = require("bcryptjs");
const { MarkupType, PrismaClient, Role } = require("@prisma/client");

const prisma = new PrismaClient();

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`[seed] Thiếu biến môi trường bắt buộc: ${name}`);
  }

  return value;
}

async function seedSuperAdmin(): Promise<void> {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log("[seed] Bỏ qua tạo Super Admin vì đã có dữ liệu user.");
    return;
  }

  const email = getRequiredEnv("SEED_SUPER_ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("SEED_SUPER_ADMIN_PASSWORD");
  const fullName = getRequiredEnv("SEED_SUPER_ADMIN_NAME");
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
      fullName,
    },
  });

  console.log(`[seed] Đã tạo Super Admin mặc định cho ${email}.`);
}

async function seedMarkupRules(): Promise<void> {
  const sampleRules = [
    {
      scope: "global",
      airline: null,
      markupType: MarkupType.FIXED,
      markupValue: "150000",
      priority: 10,
      serviceFee: 0,
    },
    {
      scope: "airline",
      airline: "VJ",
      markupType: MarkupType.FIXED,
      markupValue: "100000",
      priority: 50,
      serviceFee: 0,
    },
  ];

  for (const rule of sampleRules) {
    const existingRule = await prisma.markupRule.findFirst({
      where: {
        scope: rule.scope,
        airline: rule.airline,
        markupType: rule.markupType,
        markupValue: rule.markupValue,
        priority: rule.priority,
      },
      select: { id: true },
    });

    if (existingRule) {
      continue;
    }

    await prisma.markupRule.create({
      data: {
        scope: rule.scope,
        airline: rule.airline,
        markupType: rule.markupType,
        markupValue: rule.markupValue,
        priority: rule.priority,
        serviceFee: rule.serviceFee,
        active: true,
      },
    });
  }

  console.log("[seed] Đã đảm bảo 2 MarkupRule mẫu cho Phase 1a.");
}

async function main(): Promise<void> {
  await seedSuperAdmin();
  await seedMarkupRules();
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Seed thất bại.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
