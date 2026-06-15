import { PrismaClient } from '@prisma/client';

export class DbSeeder {
  static async cleanDatabase(prisma: PrismaClient) {
    // Trực tiếp xóa dữ liệu theo thứ tự bảng con trước, bảng cha sau để tránh lỗi khóa ngoại (Foreign Key)
    await prisma.milestoneDodItem.deleteMany({});
    await prisma.acceptanceCriterion.deleteMany({});
    await prisma.milestone.deleteMany({});
    await prisma.engagement.deleteMany({});
    await prisma.wallet.deleteMany({});
    await prisma.user.deleteMany({});
  }

  static async seedDefaults(prisma: PrismaClient) {
    // Seed bản ghi platform_settings mặc định trùng với ID trong docker-compose.test.yml
    await prisma.platformSettings.upsert({
      where: { id: '00000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000004',
        platform_fee_pct: 0.05,
        platform_wallet_id: '00000000-0000-0000-0000-000000000005', // Ví tiền hệ thống giả lập
      },
    });
  }
}