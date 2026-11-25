import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { AuthForm } from "@/components/auth-form";
import { redirectAwayWhenSignedIn } from "@/lib/server/page-session";

export default async function SignUpPage() {
  await redirectAwayWhenSignedIn("/");
  return (
    <AuthCard
      title="Create your account"
      description="No email confirmation needed. You're signed in right away."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </span>
      }
    >
      <AuthForm
        endpoint="/api/auth/register"
        submitLabel="Create account"
        successDestination="/"
        fields={[
          { name: "name", label: "Name", type: "text", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "username" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
        ]}
      />
    </AuthCard>
  );
}
