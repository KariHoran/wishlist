export type AuthUser = {
  id: string;
  email: string;
  name: string;
  handle: string;
  image: string | null;
};

export type AuthDeps = {
  findUserByEmail: (email: string) => Promise<{
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    handle: string;
    passwordHash: string;
  } | null>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
};

function sessionImage(value: string | null): string | null {
  if (!value || value.startsWith("data:")) return null;
  return value;
}

/** Credentials login — returns null when email/password invalid (no session). */
export async function authenticateCredentials(
  email: string,
  password: string,
  deps: AuthDeps,
): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;

  const user = await deps.findUserByEmail(normalized);
  if (!user) return null;

  const ok = await deps.verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.displayName,
    handle: user.handle,
    image: sessionImage(user.avatarUrl),
  };
}
