"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import {
  GUEST_ENTRY_SUPPORT_COPY,
  guestSignInErrorMessage,
  tryOpenBentoAnonymously,
} from "@/lib/auth/guest";
import { createBrowserSupabaseClient } from "@/server/supabase-browser";

type EntryMode = "entry" | "signin";

export function EntryScreen({ onSignedIn }: { onSignedIn?: () => void }) {
  const [mode, setMode] = useState<EntryMode>("entry");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onTryOpenBento() {
    setError(null);
    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await tryOpenBentoAnonymously(supabase);
      onSignedIn?.();
    } catch (caught) {
      setError(guestSignInErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (mode === "signin") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <LoginForm onSignedIn={onSignedIn} />
        <button
          type="button"
          className="text-xs text-zinc-500 underline hover:text-zinc-300"
          onClick={() => {
            setMode("entry");
            setError(null);
          }}
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-800 bg-[#11141a] p-5">
      <div>
        <h1 className="text-lg font-medium tracking-tight text-zinc-50">
          OpenBento
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          AI-native live intelligence canvas
        </p>
      </div>
      <p className="text-xs leading-5 text-zinc-500">{GUEST_ENTRY_SUPPORT_COPY}</p>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => void onTryOpenBento()}
        >
          {pending ? "Starting…" : "Try OpenBento"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}
