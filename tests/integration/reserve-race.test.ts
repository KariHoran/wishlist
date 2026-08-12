import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { hashPassword } from "@/lib/password";
import { reserveItemAtomic } from "@/lib/item-reserve";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestData,
  setupTestDatabase,
  testDbUrl,
} from "../helpers/db";

const describeIntegration =
  process.env.CI === "true" || process.env.RUN_INTEGRATION_TESTS === "1"
    ? describe
    : describe.skip;

describeIntegration("reserve race (integration)", () => {
  const prisma = getTestPrisma();
  let ownerId: string;
  let guestA: string;
  let guestB: string;
  let itemId: string;

  beforeAll(async () => {
    const ok = await setupTestDatabase();
    if (!ok) {
      throw new Error(`Could not migrate test DB at ${testDbUrl}`);
    }
  });

  beforeEach(async () => {
    await resetTestData(prisma);
    const hash = await hashPassword("password123");
    const owner = await prisma.user.create({
      data: {
        email: "owner@test.local",
        handle: "owner",
        displayName: "Owner",
        passwordHash: hash,
      },
    });
    const ga = await prisma.user.create({
      data: {
        email: "guesta@test.local",
        handle: "guesta",
        displayName: "Guest A",
        passwordHash: hash,
      },
    });
    const gb = await prisma.user.create({
      data: {
        email: "guestb@test.local",
        handle: "guestb",
        displayName: "Guest B",
        passwordHash: hash,
      },
    });
    ownerId = owner.id;
    guestA = ga.id;
    guestB = gb.id;
    const wl = await prisma.wishlist.create({
      data: {
        ownerId,
        title: "Test",
        isPublic: true,
        items: {
          create: {
            name: "Gift",
            price: 100,
            status: "AVAILABLE",
          },
        },
      },
      include: { items: true },
    });
    itemId = wl.items[0]!.id;
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("only one concurrent reserve wins", async () => {
    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });

    const [r1, r2] = await Promise.all([
      reserveItemAtomic(prisma, {
        itemId,
        userId: guestA,
        message: null,
        anonymous: false,
        item: {
          status: item.status,
          fundingMode: item.fundingMode,
          amountCollected: Number(item.amountCollected),
        },
      }),
      reserveItemAtomic(prisma, {
        itemId,
        userId: guestB,
        message: null,
        anonymous: false,
        item: {
          status: item.status,
          fundingMode: item.fundingMode,
          amountCollected: Number(item.amountCollected),
        },
      }),
    ]);

    const results = [r1, r2];
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);

    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    if (!losses[0]!.ok) expect(losses[0]!.statusCode).toBe(409);

    const updated = await prisma.item.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(updated.status).toBe("RESERVED");
    expect([guestA, guestB]).toContain(updated.reservedById);
  });
});
