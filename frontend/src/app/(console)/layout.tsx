import { Suspense } from "react";
import { account } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
async function Boundary({ children }: { children: React.ReactNode }) {
  return <AppShell account={await account()}>{children}</AppShell>;
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="boot">Opening command center…</p>}>
      <Boundary>{children}</Boundary>
    </Suspense>
  );
}
