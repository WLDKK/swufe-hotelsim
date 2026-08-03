import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

const ALERT_STATE_CONFIG_KEY = "alerts.preferences";

export type AlertActorReference = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export type StoredPlatformAlertState = {
  acknowledgedAt?: string | null;
  acknowledgedBy?: AlertActorReference | null;
  mutedUntil?: string | null;
  mutedBy?: AlertActorReference | null;
};

export type PlatformAlertState = {
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: AlertActorReference | null;
  isMuted: boolean;
  mutedUntil: string | null;
  mutedBy: AlertActorReference | null;
};

export type StoredPlatformAlertStateMap = Record<string, StoredPlatformAlertState>;

export type AlertStateMutationAction =
  | "acknowledge"
  | "unacknowledge"
  | "mute"
  | "unmute";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeActor(value: unknown): AlertActorReference | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : null,
    email: typeof value.email === "string" ? value.email : null,
    role: typeof value.role === "string" ? value.role : null,
  };
}

function normalizeStoredState(value: unknown): StoredPlatformAlertState | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    acknowledgedAt:
      typeof value.acknowledgedAt === "string" ? value.acknowledgedAt : null,
    acknowledgedBy: normalizeActor(value.acknowledgedBy),
    mutedUntil: typeof value.mutedUntil === "string" ? value.mutedUntil : null,
    mutedBy: normalizeActor(value.mutedBy),
  };
}

function compactStoredState(state: StoredPlatformAlertState) {
  const nextState: StoredPlatformAlertState = {};

  if (state.acknowledgedAt) {
    nextState.acknowledgedAt = state.acknowledgedAt;
    nextState.acknowledgedBy = state.acknowledgedBy ?? null;
  }

  if (state.mutedUntil) {
    nextState.mutedUntil = state.mutedUntil;
    nextState.mutedBy = state.mutedBy ?? null;
  }

  return nextState;
}

function compactStateMap(states: StoredPlatformAlertStateMap) {
  return Object.fromEntries(
    Object.entries(states).flatMap(([alertId, value]) => {
      const nextValue = compactStoredState(value);
      return Object.keys(nextValue).length > 0 ? [[alertId, nextValue]] : [];
    })
  ) as StoredPlatformAlertStateMap;
}

export function normalizeStoredAlertStateMap(
  value: unknown
): StoredPlatformAlertStateMap {
  if (!isRecord(value)) {
    return {};
  }

  return compactStateMap(
    Object.fromEntries(
      Object.entries(value).flatMap(([alertId, entry]) => {
        const normalizedEntry = normalizeStoredState(entry);
        return normalizedEntry ? [[alertId, normalizedEntry]] : [];
      })
    ) as StoredPlatformAlertStateMap
  );
}

export function buildAlertActorReference(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}): AlertActorReference {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    role: user.role ?? null,
  };
}

export function hydratePlatformAlertState(
  state: StoredPlatformAlertState | null | undefined,
  now = new Date()
): PlatformAlertState {
  const mutedUntil =
    state?.mutedUntil && Number.isFinite(new Date(state.mutedUntil).getTime())
      ? state.mutedUntil
      : null;
  const acknowledgedAt =
    state?.acknowledgedAt &&
    Number.isFinite(new Date(state.acknowledgedAt).getTime())
      ? state.acknowledgedAt
      : null;
  const isMuted =
    mutedUntil !== null && new Date(mutedUntil).getTime() > now.getTime();

  return {
    isAcknowledged: acknowledgedAt !== null,
    acknowledgedAt,
    acknowledgedBy: state?.acknowledgedBy ?? null,
    isMuted,
    mutedUntil,
    mutedBy: state?.mutedBy ?? null,
  };
}

export async function getStoredAlertStateMap() {
  return cacheQuery(
    ["alerts", "stored-state"],
    async () => {
      const config = await prisma.systemConfig.findUnique({
        where: {
          key: ALERT_STATE_CONFIG_KEY,
        },
        select: {
          value: true,
        },
      });

      return normalizeStoredAlertStateMap(config?.value ?? null);
    },
    {
      tags: [cacheTags.alerts],
    }
  );
}

export async function mutateStoredAlertState(input: {
  alertId: string;
  action: AlertStateMutationAction;
  actor: AlertActorReference;
  mutedUntil?: string | null;
}) {
  const states = await getStoredAlertStateMap();
  const currentState = states[input.alertId] ?? {};
  const nowIso = new Date().toISOString();
  const nextState: StoredPlatformAlertState = { ...currentState };

  switch (input.action) {
    case "acknowledge":
      nextState.acknowledgedAt = nowIso;
      nextState.acknowledgedBy = input.actor;
      break;
    case "unacknowledge":
      delete nextState.acknowledgedAt;
      delete nextState.acknowledgedBy;
      break;
    case "mute":
      nextState.mutedUntil = input.mutedUntil ?? null;
      nextState.mutedBy = input.actor;
      break;
    case "unmute":
      delete nextState.mutedUntil;
      delete nextState.mutedBy;
      break;
  }

  states[input.alertId] = nextState;
  const compactedStates = compactStateMap(states);

  await prisma.systemConfig.upsert({
    where: {
      key: ALERT_STATE_CONFIG_KEY,
    },
    update: {
      value: compactedStates,
    },
    create: {
      key: ALERT_STATE_CONFIG_KEY,
      value: compactedStates,
    },
  });

  return hydratePlatformAlertState(compactedStates[input.alertId] ?? null);
}
