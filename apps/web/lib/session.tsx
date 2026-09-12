"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DISCONNECTED,
  connect as swarmConnect,
  disconnect as swarmDisconnect,
  initSwarm,
  type SwarmConnectionInfo,
  type SwarmIdentity,
} from "@apiperitivo/swarm";
import { isRole, roleStorageKey, type Role } from "@apiperitivo/shared";
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  retry: () => void;
  /** Role preference for the current identity (null while unknown / not chosen). */
  role: Role | null;
  roleLoaded: boolean;
  setRole: (role: Role | null) => void;
};

const SessionContext = createContext<Session | null>(null);

const CONNECT_TIMEOUT_MS = 120_000;

/** Hidden host for the Swarm ID iframe; rendered by <AppShell>. */
export const SWARM_ID_FRAME_CONTAINER_ID = "swarm-id-frame";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("initializing");
  const [error, setError] = useState<string | undefined>();
  const [errorDetail, setErrorDetail] = useState<string | undefined>();
  const [info, setInfo] = useState<SwarmConnectionInfo>(DISCONNECTED);
  const [connecting, setConnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      onConnectionChange: (next) => {
        if (cancelled) return;
        setInfo(next);
        if (next.identity) {
          setConnecting(false);
          if (connectTimer.current) clearTimeout(connectTimer.current);
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

  const connect = useCallback(async () => {
    setError(undefined);
    setErrorDetail(undefined);
    setConnecting(true);
    if (connectTimer.current) clearTimeout(connectTimer.current);
    connectTimer.current = setTimeout(() => setConnecting(false), CONNECT_TIMEOUT_MS);
    try {
      await swarmConnect();
    } catch (err) {
      setConnecting(false);
      const friendly = toFriendlyError(err, "Swarm ID login failed.");
      setError(friendly.message);
      setErrorDetail(friendly.detail);
    }
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
      disconnect,
      retry,
      role,
      roleLoaded,
      setRole,
    }),
    [status, error, errorDetail, info, connecting, connect, disconnect, retry, role, roleLoaded, setRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
