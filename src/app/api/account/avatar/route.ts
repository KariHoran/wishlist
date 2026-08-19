import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureRouteError } from "@/lib/sentry-report";
import { jsonError } from "@/lib/api-response";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("unauthorized", 401);
  }
  const limit = await enforceRateLimit(RATE_LIMITS.avatarUpload, session.user.id);
  if (!limit.ok) {
    const res = await jsonError(limit.errorKey, limit.status);
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("fileMissing", 400);
  }
  if (!file.type.startsWith("image/")) {
    return jsonError("imageType", 400);
  }
  if (file.size > MAX_BYTES) {
    return jsonError("fileTooLarge", 400);
  }

  try {
    const blob = await put(
      `avatars/${session.user.id}-${Date.now()}.jpg`,
      file,
      {
        access: "public",
        contentType: file.type || "image/jpeg",
        addRandomSuffix: true,
      },
    );
    return Response.json({ url: blob.url });
  } catch (err) {
    captureRouteError(err, {
      userId: session.user.id,
      tags: { route: "avatar_upload" },
    });
    console.error("[avatar] upload failed", err);
    return jsonError("avatarUploadFailed", 500);
  }
}
