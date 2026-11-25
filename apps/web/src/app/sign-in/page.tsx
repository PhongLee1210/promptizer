import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { AuthForm } from "@/components/auth-form";
import { safeDestination } from "@/lib/safe-redirect";
import { redirectAwayWhenSignedIn } from "@/lib/server/page-session";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const destination = safeDestination((await searchParams).next);
  await redirectAwayWhenSignedIn(destination);
  return (
    <AuthCard
      title="Sign in"
      description="Use your Promptizer account."
      footer={
        <span>
          New here?{" "}
          <Link href="/sign-up" className="underline underline-offset-4">
            Create an account
          </Link>
        </span>
      }
    >
      <AuthForm
        endpoint="/api/auth/sign-in"
        submitLabel="Sign in"
        successDestination={destination}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "username" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
    </AuthCard>
  );
}
