import { formatPriceUsdc } from "@apiritivo/shared";

/** Keep the amount available to spend and the network-fee balance separate. */
export function WalletBalances({ balances }: { balances: { usdc: string; avax: string } | null }) {
  return (
    <dl className="grid min-w-0 grid-cols-2 gap-4">
      <div className="min-w-0">
        <dt className="text-xs text-subtle">Balance</dt>
        <dd className="mt-1 break-words text-lg font-medium tabular-nums">{balances ? formatPriceUsdc(balances.usdc) : "…"}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-subtle">AVAX for gas</dt>
        <dd className="mt-1 break-words text-lg font-medium tabular-nums">{balances ? Number(balances.avax).toFixed(4) : "…"}</dd>
      </div>
    </dl>
  );
}
