import Link from "next/link";
import { PASSWORD_MIN_LENGTH } from "@promptizer/shared";
import { AuthForm } from "@/components/auth-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function ChangePasswordView() {
  return (
    <>
      <PageHeader title="Change password" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-[16rem_1fr] md:gap-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Password</h2>
          <p className="text-sm text-muted-foreground">
            Changing it signs you out everywhere else. Use at least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </div>
        <Card className="w-full max-w-md">
          <CardContent>
            <AuthForm
              endpoint="/api/auth/change-password"
              submitLabel="Change password"
              successDestination="/account/password"
              successMessage="Your password has been changed."
              confirmPasswordField={{ name: "confirmPassword", mustMatch: "newPassword" }}
              fields={[
                {
                  name: "currentPassword",
                  label: "Current password",
                  type: "password",
                  autoComplete: "current-password",
                },
                { name: "newPassword", label: "New password", type: "password", autoComplete: "new-password" },
                {
                  name: "confirmPassword",
                  label: "Confirm new password",
                  type: "password",
                  autoComplete: "new-password",
                },
              ]}
            />
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            <Link href="/prompts" className="underline underline-offset-4">
              Back to all prompts
            </Link>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
