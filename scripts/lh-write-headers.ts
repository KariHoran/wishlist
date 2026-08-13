import fs from "fs";

const BASE = process.env.LH_BASE ?? "https://wishlist-ashy-three.vercel.app";
const EMAIL = process.env.LH_EMAIL ?? "demo@wishlist.app";
const PASSWORD = process.env.LH_PASSWORD ?? "password123";

function absorbSetCookie(
  jar: Map<string, string>,
  headers: Headers,
) {
  const list =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const c of list) {
    const [nv] = c.split(";");
    const i = nv.indexOf("=");
    if (i > 0) jar.set(nv.slice(0, i), nv.slice(i + 1));
  }
  const sc = headers.get("set-cookie");
  if (sc && list.length === 0) {
    for (const part of sc.split(/,(?=\s*[^;]+=)/)) {
      const [nv] = part.split(";");
      const i = nv.indexOf("=");
      if (i > 0) jar.set(nv.slice(0, i).trim(), nv.slice(i + 1).trim());
    }
  }
}

async function main() {
  const jar = new Map<string, string>();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  absorbSetCookie(jar, csrfRes.headers);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader,
    },
    body,
    redirect: "manual",
  });
  absorbSetCookie(jar, loginRes.headers);

  const finalCookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  fs.mkdirSync("lighthouse-reports", { recursive: true });
  fs.writeFileSync(
    "lighthouse-reports/extra-headers.json",
    JSON.stringify({ Cookie: finalCookie }),
  );

  const dash = await fetch(`${BASE}/dashboard`, {
    headers: { Cookie: finalCookie },
    redirect: "manual",
  });
  console.log("login", loginRes.status, "dashboard", dash.status);
  console.log("wrote lighthouse-reports/extra-headers.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
