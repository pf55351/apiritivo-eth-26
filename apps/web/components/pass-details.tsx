"use client";

import type { AccessPass } from "@apiritivo/shared";
import { useSession } from "@/lib/session";
import { useManifest } from "@/lib/use-manifest";
import { usePassBearer } from "@/lib/use-pass-bearer";
import { useService } from "@/lib/use-services";
import { BotConsole } from "./bot-console";
import { PrivateFilesPanel } from "./private-files-panel";
import { ErrorNotice, Skeleton } from "./ui";

/**
 * What a bought pass gives, shown under it in My passes: the provider's
 * private file (download once granted) and the Try API console while the
 * pass is live. The service page itself only describes the API.
 */
export function PassDetails({ pass, active }: { pass: AccessPass; active: boolean }) {
  const session = useSession();
  const { data: service, loading, error, reload } = useService(pass.serviceId);
  const manifestState = useManifest(active ? (service?.manifestRef ?? null) : null, session.status !== "initializing");
  const bearer = usePassBearer(pass);

  if (loading && !service) return <Skeleton className="mt-4 h-16" />;
  if (error && !service) return <ErrorNotice message={error.message} detail={error.detail} onRetry={reload} />;
  if (!service) return null;

  return (
    <div className="mt-5 space-y-6">
      <PrivateFilesPanel service={service} activePass={active ? pass : undefined} />
      {active ? (
        manifestState.manifest ? (
          <BotConsole serviceId={service.serviceId} manifest={manifestState.manifest} bearer={bearer} />
        ) : manifestState.error ? (
          <ErrorNotice message={manifestState.error.message} detail={manifestState.error.detail} onRetry={manifestState.reload} />
        ) : (
          <Skeleton className="h-24" />
        )
      ) : null}
    </div>
  );
}
