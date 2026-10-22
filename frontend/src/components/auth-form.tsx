"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Box, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
const subscribe = () => () => {};
export function AuthForm({ register = false }: { register?: boolean }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" className="brand">
          <Box /> LOGITRACK<span>®</span>
        </Link>
        <div>
          <p className="eyebrow">CONNECTED. CONTROLLED. IN MOTION.</p>
          <h1>
            Every movement.
            <br />
            <em>One clear view.</em>
          </h1>
          <p>
            Your inventory, orders, and operations.
            <br />
            Orchestrated in one intelligent workspace.
          </p>
          <div className="auth-orbit">
            <Box size={100} />
            <span className="orbit-dot" />
          </div>
        </div>
        <small>LOGISTICS INTELLIGENCE / DESIGNED FOR WHAT’S NEXT</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <ShieldCheck className="cyan" size={30} />
          <p className="eyebrow">YOUR OPERATIONS START HERE</p>
          <h2>{register ? "Create your account" : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Join your team’s logistics workspace."
              : "Sign in to your command center."}
          </p>
          <form
            method="post"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                const r = await fetch(
                  `/api/gateway/auth/${register ? "register" : "login"}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(Object.fromEntries(data)),
                  },
                );
                const b = await r.json();
                if (!r.ok)
                  throw new Error(
                    b.error ||
                      (b.errors
                        ? Object.values(b.errors).flat().join(" ")
                        : "Unable to sign in"),
                  );
                window.location.assign(
                  register ? "/login?registered=1" : "/dashboard",
                );
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Connection failed",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 12 : 1}
              />
            </label>
            {register && (
              <small className="muted">
                Use 12+ characters, uppercase, lowercase, a number and a symbol.
                New accounts have read-only access.
              </small>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button
              disabled={busy || !hydrated}
              className="primary wide"
              type="submit"
            >
              {busy
                ? "Connecting…"
                : register
                  ? "Create account"
                  : "Enter command center"}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="muted">
            {register ? "Already have an account?" : "New to LogiTrack?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <small className="secure-note">
            <ShieldCheck size={14} /> Secure access · Role-based permissions
          </small>
        </div>
      </section>
    </main>
  );
}
