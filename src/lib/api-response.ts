import { NextResponse } from "next/server";
import { tError } from "@/lib/i18n-server";

export async function jsonError(
  key: string,
  status: number,
  extra?: Record<string, unknown>,
  params?: Record<string, string | number>,
) {
  return NextResponse.json(
    { error: await tError(key, params), ...extra },
    { status },
  );
}

export async function translateErrorKey(
  result: {
    errorKey: string;
    errorParams?: Record<string, string>;
  },
  status: number,
  extra?: Record<string, unknown>,
) {
  return jsonError(result.errorKey, status, extra, result.errorParams);
}
