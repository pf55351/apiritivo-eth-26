"use client";

import Image from "next/image";
import { BackLink, Button } from "@/components/ui";
import { useSession } from "@/lib/session";
import brandIcon from "./icon.png";

export default function NotFound() {
  const { role } = useSession();
  const provider = role === "provider";

  return (
    <div>
      <BackLink href="/">Home</BackLink>
      <section aria-labelledby="not-found-title" className="mx-auto flex min-h-[55svh] max-w-xl flex-col items-center justify-center py-12 text-center sm:py-16">
        <div aria-hidden="true" className="flex items-center justify-center gap-3 font-heading text-[7rem] font-medium leading-none text-content sm:gap-5 sm:text-[10rem]">
          <span>4</span>
          <Image src={brandIcon} alt="" width={144} height={144} sizes="(min-width: 640px) 144px, 104px" priority className="h-[104px] w-[104px] shrink-0 sm:h-36 sm:w-36" />
          <span>4</span>
        </div>
        <h1 id="not-found-title" className="mt-8 text-3xl font-medium sm:text-4xl">
          <span className="sr-only">404: </span>Page not found
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">This page doesn’t exist or has moved.</p>
        <div className="mt-8">
          <Button href={provider ? "/provider" : "/marketplace"} className="min-h-11">
            {provider ? "My APIs" : "Explore APIs"}
            <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </section>
    </div>
  );
}
