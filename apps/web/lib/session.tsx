"use client";

import { isRole, type Role } from "@apiritivo/shared";
import { DISCONNECTED, initSwarm, type SwarmConnectionInfo, type SwarmIdentity, disconnect as swarmDisconnect } from "@apiritivo/swarm";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { publicEnv } from "./env";
import { toFriendlyError } from "./errors";

export type SessionStatus = "initializing" | "ready" | "error";

export type Session = {
  status: SessionStatus;
  error?: string;
  errorDetail?: string;
  identity: SwarmIdentity | null;
  canUpload: boolean;
  uploadMode?: SwarmConnectionInfo["uploadMode"];
  uploadUnavailableReason?: SwarmConnectionInfo["uploadUnavailableReason"];
  connecting: boolean;
  /** Show the SDK-owned sign-in button, preserving the iframe's popup opener. */
  connect: () => void;
  /** Close the sign-in dialog without disconnecting an existing session. */
  cancelConnect: () => void;
  disconnect: () => Promise<void>;
  retry: () => void;
  /** Workspace preference (one per browser), chosen before signing in. */
  role: Role | null;
  roleLoaded: boolean;
  setRole: (role: Role | null) => void;
  /**
   * Change workspace the only way the app allows: remember the choice, sign
   * out of Swarm ID when signed in, and open the sign-in dialog again.
   */
  switchWorkspace: (role: Role) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);
const WORKSPACE_KEY = "apiritivo:workspace";

/** Persistent host for the Swarm ID iframe; shown in the sign-in dialog. */
export const SWARM_ID_FRAME_CONTAINER_ID = "swarm-id-frame";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("initializing");
  const [error, setError] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [info, setInfo] = useState<SwarmConnectionInfo>(DISCONNECTED);
  const [connecting, setConnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [rolePreference, setRolePreference] = useState<{ role: Role | null; loaded: boolean }>({ role: null, loaded: false });
  const { role, loaded: roleLoaded } = rolePreference;

  useEffect(() => {
    let cancelled = false;
    setStatus("initializing");
    setError(undefined);
    setErrorDetail(undefined);
    initSwarm({
      iframeOrigin: publicEnv.swarmIframeOrigin,
      appName: publicEnv.appName,
      appDescription: "Machine-readable service marketplace",
      gatewayUrl: publicEnv.swarmGatewayUrl,
      subsidisedGatewayUrl: publicEnv.swarmSubsidisedGatewayUrl,
      containerId: SWARM_ID_FRAME_CONTAINER_ID,
      debug: publicEnv.isDev,
      onConnectionChange: (next) => {
        if (cancelled) return;
        setInfo(next);
        if (next.identity) {
          setConnecting(false);
        }
      },
    })
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const friendly = toFriendlyError(err, "Swarm ID login failed.");
        setStatus("error");
        setError(friendly.message);
        setErrorDetail(friendly.detail);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(WORKSPACE_KEY);
    } catch {
      /* localStorage unavailable: the workspace stays in memory only */
    }
    setRolePreference({ role: isRole(stored) ? stored : null, loaded: true });
  }, []);

  useEffect(() => {
    if (!roleLoaded) return;
    try {
      if (role) window.localStorage.setItem(WORKSPACE_KEY, role);
      else window.localStorage.removeItem(WORKSPACE_KEY);
    } catch {
      /* localStorage unavailable: role stays in memory only */
    }
  }, [role, roleLoaded]);

  const setRole = useCallback((next: Role | null) => {
    setRolePreference({ role: next, loaded: true });
  }, []);

  const connect = useCallback(() => {
    setError(undefined);
    setErrorDetail(undefined);
    // The next click happens inside the SDK iframe. Its popup then has the
    // iframe as opener, so session handover works with partitioned storage.
    setConnecting(true);
  }, []);

  const cancelConnect = useCallback(() => {
    setConnecting(false);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await swarmDisconnect();
    } finally {
      setInfo(DISCONNECTED);
    }
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const signedIn = Boolean(info.identity);
  const switchWorkspace = useCallback(
    async (next: Role) => {
      setRole(next);
      if (!signedIn) return;
      await disconnect();
      connect();
    },
    [setRole, signedIn, disconnect, connect],
  );

  const value = useMemo<Session>(
    () => ({
      status,
      error,
      errorDetail,
      identity: info.identity,
      canUpload: info.canUpload,
      uploadMode: info.uploadMode,
      uploadUnavailableReason: info.uploadUnavailableReason,
      connecting,
      connect,
      cancelConnect,
      disconnect,
      retry,
      role,
      roleLoaded,
      setRole,
      switchWorkspace,
    }),
    [status, error, errorDetail, info, connecting, connect, cancelConnect, disconnect, retry, role, roleLoaded, setRole, switchWorkspace],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
