"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="flex h-full items-center justify-center bg-[#0b0d10] px-4">
      <LoginForm onSignedIn={() => router.replace("/")} />
    </main>
  );
}
