import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const cookie = "logitrack_session";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  const method = request.method;
  if (
    method !== "GET" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  const jar = await cookies();
  if (path === "auth/logout" && method === "POST") {
    jar.delete(cookie);
    return NextResponse.json({ ok: true });
  }
  const auth = /^auth\/(login|register)$/.test(path) && method === "POST";
  if (
    !auth &&
    !/^(inventory|orders)(\/\d+)?$/.test(path) &&
    path !== "orders/analytics"
  )
    return new NextResponse(null, { status: 404 });
  if (!["GET", "POST", "DELETE"].includes(method))
    return new NextResponse(null, { status: 405 });
  const token = jar.get(cookie)?.value;
  if (!auth && !token)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const response = await fetch(
      `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5187"}/api/${path}`,
      {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          ...(token && !auth ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: method === "POST" ? await request.text() : undefined,
      },
    );
    if (response.status === 401 && !auth) jar.delete(cookie);
    if (path === "auth/login" && response.ok) {
      const body = await response.json();
      jar.set(cookie, body.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: body.expiresInSeconds,
      });
      return NextResponse.json({ ok: true });
    }
    return new NextResponse(
      response.status === 204 ? null : await response.text(),
      {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The logistics API is unavailable. Check the backend and try again.",
      },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
