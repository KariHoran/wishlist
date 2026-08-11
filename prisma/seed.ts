import { PrismaClient, ItemStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.contribution.deleteMany();
  await prisma.item.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);

  const owner = await prisma.user.create({
    data: {
      email: "demo@wishlist.app",
      handle: "demo",
      displayName: "Карина",
      passwordHash,
      avatarUrl: "/decor/avatar-cat.svg",
    },
  });

  const friends = await Promise.all(
    [
      { email: "katya@wishlist.app", handle: "katya", displayName: "Катя" },
      { email: "anya@wishlist.app", handle: "anya", displayName: "Аня" },
      { email: "egor@wishlist.app", handle: "egor", displayName: "Егор" },
      { email: "ulyana@wishlist.app", handle: "ulyana", displayName: "Ульяна" },
      { email: "nastya@wishlist.app", handle: "nastya", displayName: "Настя" },
    ].map((u) =>
      prisma.user.create({
        data: { ...u, passwordHash, avatarUrl: "/decor/avatar-cat.svg" },
      }),
    ),
  );

  for (const f of friends) {
    const [a, b] = owner.id < f.id ? [owner.id, f.id] : [f.id, owner.id];
    await prisma.friendship.create({ data: { userAId: a, userBId: b } });
  }

  const birthday = await prisma.wishlist.create({
    data: {
      title: "День рождения",
      emoji: "💖",
      isPublic: true,
      deadline: new Date("2026-04-22"),
      ownerId: owner.id,
    },
  });

  const titles = [
    { title: "Новый год", items: 9 },
    { title: "Штучки", items: 13 },
    { title: "Украшения", items: 10 },
    { title: "Динозавры!!", items: 12 },
    { title: "Декор", items: 3 },
  ];

  for (const t of titles) {
    const w = await prisma.wishlist.create({
      data: {
        title: t.title,
        isPublic: true,
        ownerId: owner.id,
      },
    });
    for (let i = 0; i < Math.min(t.items, 3); i++) {
      await prisma.item.create({
        data: {
          wishlistId: w.id,
          name: `${t.title} #${i + 1}`,
          price: 500 + i * 100,
          imageUrl: "/decor/halftone-cat.svg",
        },
      });
    }
  }

  const itemDefs: {
    name: string;
    price: number;
    status: ItemStatus;
    imageUrl: string;
  }[] = [
    {
      name: "Фигурка popmart",
      price: 690,
      status: "RESERVED",
      imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&q=80",
    },
    {
      name: "Кольцо сакура",
      price: 5900,
      status: "RESERVED",
      imageUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80",
    },
    {
      name: "Тамагочи с динозавром",
      price: 690,
      status: "AVAILABLE",
      imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&q=80",
    },
    {
      name: "Нинтендо",
      price: 1599,
      status: "FUNDING",
      imageUrl: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=400&q=80",
    },
    {
      name: "Кольцо",
      price: 5900,
      status: "AVAILABLE",
      imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80",
    },
  ];

  const createdItems = [];
  for (const def of itemDefs) {
    const item = await prisma.item.create({
      data: {
        wishlistId: birthday.id,
        name: def.name,
        price: def.price,
        status: def.status,
        imageUrl: def.imageUrl,
        reservedById: def.status === "RESERVED" ? friends[0].id : null,
        amountCollected: def.status === "FUNDING" ? 690 : 0,
      },
    });
    createdItems.push(item);
  }

  const nintendo = createdItems.find((i) => i.name === "Нинтендо")!;
  // Order matches mock: Карина 💛 first, then friends
  const contributors = [owner, ...friends];
  for (const u of contributors) {
    await prisma.contribution.create({
      data: { itemId: nintendo.id, userId: u.id, amount: 115 },
    });
  }
  // 690 / 1599 ≈ 43.15% as on the funding modal mock
  await prisma.item.update({
    where: { id: nintendo.id },
    data: { amountCollected: 115 * contributors.length, price: 1599 },
  });

  console.log("Seed OK");
  console.log("Login: demo@wishlist.app / password123");
  console.log("Friends also use password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
