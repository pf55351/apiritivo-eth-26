"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { AccountDropdown } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { GuestMenu } from "./guest-menu";
import { ProfileAvatar, StatusDot } from "./ui";

/** Header account control for the Provider workspace: the Swarm ID identity. */
export function SwarmMenu() {
  const session = useSession();
  const wallet = useSwarmWallet();
  const router = useRouter();

  if (!session.identity) {
    return (
      <GuestMenu action={session.connecting ? "Complete sign in" : "Enter with Swarm ID"} onAction={session.connect} disabled={session.status !== "ready" || session.connecting} />
    );
  }

  const { identity } = session;
  return (
    <AccountDropdown
      label={`Account for ${identity.name}`}
      trigger={
        <>
          <ProfileAvatar name={identity.name} size={34} />
          <span className="hidden max-w-[120px] truncate text-sm xl:block">{identity.name}</span>
        </>
      }
    >
      {(close) => (
        <AccountPanel name={identity.name} address={wallet.address}>
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="text-muted">Swarm upload</span>
            <StatusDot tone={session.canUpload ? "success" : "warning"}>{session.canUpload ? "Available" : "Unavailable"}</StatusDot>
          </div>
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            onClick={async () => {
              close();
              await session.disconnect();
              router.push("/");
            }}
          >
            Logout
          </button>
        </AccountPanel>
      )}
    </AccountDropdown>
  );
}
