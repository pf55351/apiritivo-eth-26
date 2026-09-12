"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useSwarmWallet } from "@/lib/swarm-wallet";
import { AccountDropdown } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { ProviderAccountTabs } from "./account-tabs";
import { GuestMenu } from "./guest-menu";
import { ProfileAvatar } from "./ui";
import { WalletSection } from "./wallet-section";

/**
 * Header account control: the Swarm ID identity in both workspaces. The
 * Client variant adds the payment wallet; the Provider variant a Wallet tab
 * and a Connection tab (storage, Arkiv writer).
 */
export function SwarmMenu({ workspace }: { workspace: "client" | "provider" }) {
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
        <AccountPanel name={identity.name} address={workspace === "provider" ? wallet.address : null}>
          {workspace === "client" ? <WalletSection onClose={close} /> : <ProviderAccountTabs />}
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
