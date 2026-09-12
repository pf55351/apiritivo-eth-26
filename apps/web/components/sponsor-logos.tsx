import Image from "next/image";

export const ETHROME_SPONSORS_URL = "https://www.ethrome.org/#sponsorZone";

const SPONSORS = [
  { name: "Team1", href: "https://team1.blog/", image: "team1.svg", lightImage: "team1-light.svg", width: 1027, height: 289 },
  { name: "Arkiv", href: "https://arkiv.network/", image: "arkiv.svg", lightImage: null, width: 1389, height: 320 },
  { name: "Swarm", href: "https://www.ethswarm.org/", image: "swarm.png", lightImage: null, width: 1002, height: 269 },
  { name: "ENS", href: "https://ens.domains/", image: "ens.svg", lightImage: null, width: 153, height: 48 },
] as const;

/** ETHRome's 2026 sponsor artwork, with a readable presentation in each theme. */
export function SponsorLogos() {
  return (
    <ul aria-label="ETHRome 2026 sponsors" className="grid grid-cols-2 items-center gap-x-6 gap-y-3 rounded-panel bg-surface px-4 py-3 sm:grid-cols-4 sm:gap-x-8">
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
              className={`${sponsor.lightImage ? "theme-dark-only" : "sponsor-monochrome"} h-auto max-h-9 w-full max-w-40 object-contain sm:max-h-11 sm:max-w-48`}
            />
            {sponsor.lightImage ? (
              <Image
                src={`/brand/sponsors/${sponsor.lightImage}`}
                alt={sponsor.name}
                width={sponsor.width}
                height={sponsor.height}
                unoptimized
                className="theme-light-only h-auto max-h-9 w-full max-w-40 object-contain sm:max-h-11 sm:max-w-48"
              />
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
