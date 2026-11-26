import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { APP_CONFIG } from "@/config/app-config";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const LOGO_SIZE_PX = 56;

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-svh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Link href="/" aria-label={APP_CONFIG.name} className="mx-auto block w-fit rounded-2xl bg-background p-3">
              <Image src="/logo.png" alt="" width={LOGO_SIZE_PX} height={LOGO_SIZE_PX} priority />
            </Link>
            <div className="space-y-2">
              <h2 className="text-5xl font-light text-primary-foreground">{APP_CONFIG.name}</h2>
              <p className="text-xl text-primary-foreground/80">{APP_CONFIG.meta.description}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-12">
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mx-auto max-w-xl text-muted-foreground">{description}</p>}
          </div>
          <div className="space-y-4">
            {children}
            {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
