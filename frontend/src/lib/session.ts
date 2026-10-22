import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export async function account() {
  await connection();
  const token = (await cookies()).get("logitrack_session")?.value;
  if (!token) redirect("/login");
  try {
    // Claims only control presentation; the API validates signature, expiry and role on every request.
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    if (claims.exp * 1000 <= Date.now()) redirect("/login?expired=1");
    const role =
      claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    return {
      email: String(claims.email || ""),
      manager: Array.isArray(role)
        ? role.includes("Manager")
        : role === "Manager",
    };
  } catch {
    redirect("/login");
  }
}
