import Link from "next/link";
export default function Page() {
  return (
    <main className="boot">
      <h1>Access restricted</h1>
      <p>A Manager role is required for this operation.</p>
      <Link href="/dashboard">Return to dashboard</Link>
    </main>
  );
}
