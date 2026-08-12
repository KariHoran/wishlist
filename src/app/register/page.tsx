"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { Logo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { WinSetup, WinWelcome } from "@/components/WinDecor";
import { useNetwork } from "@/components/NetworkProvider";

export default function RegisterPage() {
  const { online, requireOnline } = useNetwork();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!requireOnline()) return;
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, passwordConfirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        setLoading(false);
        return;
      }
      const loginResult = (await Promise.race([
        signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: "/dashboard",
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), 10_000);
        }),
      ])) as { error?: string | null; ok?: boolean } | string | undefined;

      if (
        !loginResult ||
        (typeof loginResult !== "string" &&
          (loginResult.error || loginResult.ok === false))
      ) {
        setError("Аккаунт создан, но войти не удалось — попробуйте на странице входа");
        return;
      }
      window.location.assign("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error && err.message === "timeout"
          ? "Не удалось войти, попробуйте снова"
          : "Сеть недоступна",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-frame grid-bg relative isolate overflow-hidden">
      {/* decor — behind form */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/notepad.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor top-8 left-4 hidden w-12 opacity-80 lg:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/halftone-cat.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor top-1/3 left-3 hidden w-24 opacity-70 lg:block"
      />
      <div className="page-decor top-6 right-3 hidden opacity-90 lg:block">
        <WinWelcome />
        <WinSetup className="absolute top-16 -right-6 rotate-[-4deg]" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decor/disk.svg"
        alt=""
        loading="lazy"
        decoding="async"
        className="page-decor right-8 bottom-14 hidden w-16 opacity-80 lg:block"
      />
      <div
        aria-hidden
        className="page-decor right-4 bottom-4 hidden h-12 w-12 bg-[url('/decor/pixel-bunny.svg')] bg-contain bg-center bg-no-repeat opacity-80 lg:block"
      />

      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-10px)] w-full max-w-md flex-col items-center justify-center px-4 py-10">
        <Logo size="lg" href={null} />
        <p className="pixel-font mt-3 mb-8 text-center text-xs md:text-sm">
          Welcome back! Let&apos;s check your wishes
        </p>

        <form onSubmit={onSubmit} className="hard-border w-full space-y-5 bg-white/90 p-5 md:p-6">
          <div>
            <label htmlFor="email" className="pixel-font mb-2 block text-sm">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Ваша почта"
              className="input-field"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="pixel-font mb-2 block text-sm">
              Пароль
            </label>
            <PasswordInput
              id="password"
              name="password"
              placeholder="Ваш пароль"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="passwordConfirm" className="pixel-font mb-2 block text-sm">
              Повторите пароль
            </label>
            <PasswordInput
              id="passwordConfirm"
              name="passwordConfirm"
              placeholder="Повторите пароль"
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="mono-font text-base text-red-600">{error}</p>}

          <button type="submit" disabled={loading || !online} className="btn-primary w-full py-3 text-base" title={!online ? "Нет соединения" : undefined}>
            {loading ? "..." : "Регистрация"}
          </button>

          <p className="mono-font text-center text-lg text-[#777]">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="underline underline-offset-4 leading-normal">
              Войти
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
