"use client";

import { AuthGate } from "@/components/auth-gate";
import { PassesView } from "@/components/passes-view";
import { useActiveIdentity } from "@/lib/identity";
import { useMyPasses } from "@/lib/use-access";

function PassesList() {
  const identity = useActiveIdentity();
  const { data, initialLoading, refreshing, error, timing, reload } = useMyPasses(identity?.id ?? null);
  return <PassesView data={data} initialLoading={initialLoading} refreshing={refreshing} error={error} timing={timing} reload={reload} />;
}

export default function PassesPage() {
  return (
    <AuthGate title="Sign in for your passes">
      <PassesList />
    </AuthGate>
  );
}
