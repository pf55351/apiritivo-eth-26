"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DISCONNECTED,
  disconnect as swarmDisconnect,
  initSwarm,
  type SwarmConnectionInfo,
  type SwarmIdentity,
} from "@apiritivo/swarm";
import { isRole, roleStorageKey, type Role } from "@apiritivo/shared";
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
  /** Role preference for the current identity (null while unknown / not chosen). */
  role: Role | null;
  roleLoaded: boolean;
  setRole: (role: Role | null) => void;
};

const SessionContext = createContext<Session | null>(null);

/** Persistent host for the Swarm ID iframe; shown in the sign-in dialog. */
export const SWARM_ID_FRAME_CONTAINER_ID = "swarm-id-frame";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("initializing");
  const [error, setError] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [info, setInfo] = useState<SwarmConnectionInfo>(DISCONNECTED);
  const [connecting, setConnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Role, keyed by identity id in localStorage.
  const identityId = info.identity?.id ?? null;
  const [role, setRoleState] = useState<Role | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);

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
    setRoleLoaded(false);
    if (!identityId) {
      setRoleState(null);
      setRoleLoaded(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(roleStorageKey(identityId));
      setRoleState(isRole(stored) ? stored : null);
    } catch {
      setRoleState(null);
    }
    setRoleLoaded(true);
  }, [identityId]);

  const setRole = useCallback(
    (next: Role | null) => {
      setRoleState(next);
      if (!identityId) return;
      try {
        if (next) window.localStorage.setItem(roleStorageKey(identityId), next);
        else window.localStorage.removeItem(roleStorageKey(identityId));
      } catch {
        /* localStorage unavailable: role stays in memory only */
      }
    },
    [identityId],
  );

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
      setRoleState(null);
    }
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

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
    }),
    [status, error, errorDetail, info, connecting, connect, cancelConnect, disconnect, retry, role, roleLoaded, setRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
