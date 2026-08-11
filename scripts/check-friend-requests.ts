import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 2,
    select: { id: true, handle: true, displayName: true },
  });
  console.log("users", users.length);
  if (users.length < 2) {
    console.log("NEED_TWO_USERS");
    return;
  }
  const [a, b] = users;
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { fromId: a.id, toId: b.id },
        { fromId: b.id, toId: a.id },
      ],
    },
  });
  const pair = a.id < b.id ? ([a.id, b.id] as const) : ([b.id, a.id] as const);
  await prisma.friendship.deleteMany({
    where: { userAId: pair[0], userBId: pair[1] },
  });

  const req = await prisma.friendRequest.create({
    data: { fromId: a.id, toId: b.id },
  });
  console.log("created", req.status);

  await prisma.friendRequest.update({
    where: { id: req.id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  await prisma.friendship.create({
    data: { userAId: pair[0], userBId: pair[1] },
  });
  const fr = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } },
  });
  console.log("friendship", Boolean(fr));

  await prisma.friendship.delete({
    where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } },
  });
  await prisma.friendRequest.delete({ where: { id: req.id } });
  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
