/**
 * Login on prod and print cookie header for Lighthouse --extra-headers.
 *   npx tsx scripts/lh-auth-cookie.ts
 */
const BASE = process.env.LH_BASE ?? "https://wishlist-ashy-three.vercel.app";
const EMAIL = process.env.LH_EMAIL ?? "demo@wishlist.app";
const PASSWORD = process.env.LH_PASSWORD ?? "password123";

async function main() {
  // CSRF/session bootstrap
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const csrfCookies = csrfRes.headers.getSetCookie?.() ?? [];
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const cookieJar = new Map<string, string>();
  for (const c of csrfCookies) {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    cookieJar.set(nv.slice(0, i), nv.slice(i + 1));
  }
  // also parse classic set-cookie if getSetCookie missing
  const sc = csrfRes.headers.get("set-cookie");
  if (sc && cookieJar.size === 0) {
    for (const part of sc.split(/,(?=\s*[^;]+=)/)) {
      const [nv] = part.split(";");
      const i = nv.indexOf("=");
      if (i > 0) cookieJar.set(nv.slice(0, i).trim(), nv.slice(i + 1).trim());
    }
  }

  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const cookieHeader = [...cookieJar.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body,
    redirect: "manual",
  });

  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  for (const c of loginCookies) {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    cookieJar.set(nv.slice(0, i), nv.slice(i + 1));
  }
  const sc2 = loginRes.headers.get("set-cookie");
  if (sc2) {
    for (const part of sc2.split(/,(?=\s*[^;]+=)/)) {
      const [nv] = part.split(";");
      const i = nv.indexOf("=");
      if (i > 0) cookieJar.set(nv.slice(0, i).trim(), nv.slice(i + 1).trim());
    }
  }

  const finalCookie = [...cookieJar.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  console.log("status", loginRes.status);
  console.log("location", loginRes.headers.get("location"));
  console.log("COOKIE_HEADER=" + finalCookie);

  // verify
  const dash = await fetch(`${BASE}/dashboard`, {
    headers: { Cookie: finalCookie },
    redirect: "manual",
  });
  console.log("dashboard", dash.status, dash.headers.get("location"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
