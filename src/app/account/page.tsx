import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/Navbar";
import { AccountForm } from "@/components/AccountForm";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  return (
    <div className="page-frame grid-bg">
      <Navbar avatarUrl={user.avatarUrl} displayName={user.displayName} />
      <main className="mx-auto max-w-lg px-4 py-6 md:px-8">
        <h1 className="display-font mb-6 text-2xl">Аккаунт</h1>
        <AccountForm
          displayName={user.displayName}
          handle={user.handle}
          email={user.email}
          avatarUrl={user.avatarUrl}
          emailNotificationsEnabled={user.emailNotificationsEnabled}
        />
        <Link href="/account/refunds" className="btn-secondary mt-6 block w-full text-center">
          Возвраты
        </Link>
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn-secondary w-full">
            Выйти
          </button>
        </form>
      </main>
    </div>
  );
}
