"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      onSignedIn?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border border-zinc-800 bg-[#11141a] p-5"
      onSubmit={(event) => void submit(event)}
    >
      <h1 className="text-sm font-medium text-zinc-100">
        {mode === "signin" ? "Sign in to OpenBento" : "Create an account"}
      </h1>
      <p className="text-xs leading-5 text-zinc-500">
        Hosted Supabase Auth. Reload after login restores your canvases from
        the DomainStore.
      </p>
      <Input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        type="password"
        required
        minLength={6}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
      </Button>
      <button
        type="button"
        className="text-xs text-zinc-500 underline hover:text-zinc-300"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
