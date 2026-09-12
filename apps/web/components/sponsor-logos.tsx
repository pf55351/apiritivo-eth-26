import Image from "next/image";

export const ETHROME_SPONSORS_URL = "https://www.ethrome.org/#sponsorZone";

const SPONSORS = [
  { name: "Avalanche Team1", href: "https://team1.blog/", image: "team1.svg", width: 1027, height: 289 },
  { name: "Arkiv", href: "https://arkiv.network/", image: "arkiv.svg", width: 1389, height: 320 },
  { name: "Swarm", href: "https://www.ethswarm.org/", image: "swarm.png", width: 192, height: 51 },
  { name: "ENS", href: "https://ens.domains/", image: "ens.svg", width: 153, height: 48 },
] as const;

/** Original logo artwork from ETHRome's 2026 sponsor section. */
export function SponsorLogos() {
  return (
    <ul aria-label="ETHRome 2026 sponsors" className="grid grid-cols-2 items-center gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-8">
      {SPONSORS.map((sponsor) => (
        <li key={sponsor.name} className="min-w-0">
          <a
            href={sponsor.href}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-20 items-center justify-center rounded-control px-3 opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
          >
            <Image
              src={`/brand/sponsors/${sponsor.image}`}
              alt={sponsor.name}
              width={sponsor.width}
              height={sponsor.height}
              unoptimized
              className="h-auto max-h-9 w-full max-w-40 object-contain sm:max-h-11 sm:max-w-48"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
