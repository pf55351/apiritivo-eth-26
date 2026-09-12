"use client";

import { AccountDropdown, GuestAccountIcon } from "./account-dropdown";
import { AccountPanel } from "./account-panel";
import { Button } from "./ui";

/**
 * The account control before anyone is signed in: the same dropdown in both
 * workspaces, with the workspace's own sign-in action inside.
 */
export function GuestMenu({ action, onAction, disabled = false }: { action: string; onAction: () => void; disabled?: boolean }) {
  return (
    <AccountDropdown label="Account" trigger={<GuestAccountIcon />}>
      {(close) => (
        <AccountPanel>
          <div className="px-3 py-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                close();
                onAction();
              }}
              disabled={disabled}
            >
              {action}
            </Button>
          </div>
        </AccountPanel>
      )}
    </AccountDropdown>
  );
}

/** Placeholder with the guest icon while the saved workspace is still being read. */
export function PendingMenu() {
  return (
    <span className="flex min-h-11 w-11 items-center justify-center p-1 sm:w-auto sm:pr-3" aria-hidden="true">
      <GuestAccountIcon />
    </span>
  );
}
