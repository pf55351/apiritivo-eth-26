/** Public runtime config (NEXT_PUBLIC_* is inlined at build time). */
export const publicEnv = {
  swarmIframeOrigin: process.env.NEXT_PUBLIC_SWARM_ID_IFRAME_ORIGIN || "https://swarm-id.snaha.net",
  appName: process.env.NEXT_PUBLIC_SWARM_ID_APP_NAME || "APIperitivo",
  // Default = the Bee API the Swarm ID proxy itself uploads through (Swarm mainnet).
  swarmGatewayUrl: process.env.NEXT_PUBLIC_SWARM_GATEWAY_URL || "https://api.gateway.ethswarm.org",
  // Subsidised gateway that stamps uploads for identities without a drive.
  // Same value the official Swarm ID demo uses. Set to "off" to disable.
  swarmSubsidisedGatewayUrl:
    process.env.NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL === "off"
      ? undefined
      : process.env.NEXT_PUBLIC_SWARM_SUBSIDISED_GATEWAY_URL || "https://api.gateway.ethswarm.org/",
  isDev: process.env.NODE_ENV !== "production",
};
