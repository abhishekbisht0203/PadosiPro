import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import { sessionStore } from '../api/session';
import type { MeResponse, Profile } from '../api/types';

/**
 * Where a user is in the journey. The navigator switches on this, which is why
 * it is a single discriminated value rather than a stack of booleans — the
 * ordering rules live in exactly one place.
 *
 *   welcome  -> no token
 *   verify   -> registered, email not yet confirmed
 *   profile  -> signed in, first-login details not captured yet
 *   tasks    -> profile saved, tasks not chosen yet
 *   home     -> profile saved and at least one task chosen
 */
export type AppStage = 'welcome' | 'verify' | 'profile' | 'tasks' | 'home';

export interface AuthState {
  stage: AppStage;
  /** True while the stored token is being checked against the server. */
  initialising: boolean;
  email: string | null;
  token: string | null;
  profile: Profile | null;
  selectedTaskCount: number;
  /** Set when a cold-start `/me` call failed for a reason worth showing. */
  initialLoadError: string | null;
}

export interface AuthContextValue extends AuthState {
  setPendingEmail(email: string): void;
  completeVerification(email: string, token: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  saveProfile(profile: Omit<Profile, 'businessName'> & { businessName?: string | null }): Promise<void>;
  refreshSelectedTaskCount(): Promise<void>;
  setSelectedTaskCount(count: number): void;
  retryInitialLoad(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL: AuthState = {
  stage: 'welcome',
  initialising: true,
  email: null,
  token: null,
  profile: null,
  selectedTaskCount: 0,
  initialLoadError: null,
};

function stageFor(session: MeResponse | null, hasToken: boolean, pendingEmail: string | null): AppStage {
  if (!hasToken) return pendingEmail ? 'verify' : 'welcome';
  if (!session) return 'welcome';
  if (!session.hasCompletedProfile) return 'profile';
  if (session.selectedTaskCount === 0) return 'tasks';
  return 'home';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  /**
   * Cold start: read the stored token, confirm it with the server, and work out
   * which screen to open on. Never throws — a failure lands in
   * `initialLoadError` so the Welcome screen can explain and offer a retry.
   */
  const loadSession = useCallback(async () => {
    setState((prev) => ({ ...prev, initialising: true, initialLoadError: null }));

    const token = await sessionStore.loadToken();
    if (!token) {
      setState((prev) => ({ ...INITIAL, initialising: false, email: prev.email }));
      return;
    }

    try {
      const session = await api.me(token);
      setState({
        stage: stageFor(session, true, null),
        initialising: false,
        email: session.user.email,
        token,
        profile: session.profile,
        selectedTaskCount: session.selectedTaskCount,
        initialLoadError: null,
      });
    } catch (err) {
      const apiErr = toApiError(err);
      // A rejected token is not a failure state — the user simply needs to sign
      // in again. Anything else (offline, server down) is worth showing.
      const tokenRejected = apiErr.code === 'TOKEN_EXPIRED' || apiErr.code === 'TOKEN_INVALID' || apiErr.code === 'AUTH_REQUIRED';

      if (tokenRejected) {
        await sessionStore.clear();
        setState((prev) => ({ ...INITIAL, initialising: false, email: prev.email }));
        return;
      }

      setState((prev) => ({
        ...prev,
        initialising: false,
        token: null,
        initialLoadError: apiErr.message,
      }));
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const setPendingEmail = useCallback((email: string) => {
    setState((prev) => ({ ...prev, email, stage: 'verify' }));
  }, []);

  const adoptSession = useCallback(async (email: string, token: string) => {
    await sessionStore.saveToken(token);
    const session = await api.me(token);
    setState({
      stage: stageFor(session, true, null),
      initialising: false,
      email,
      token,
      profile: session.profile,
      selectedTaskCount: session.selectedTaskCount,
      initialLoadError: null,
    });
  }, []);

  const completeVerification = useCallback(
    async (email: string, token: string) => {
      await adoptSession(email, token);
    },
    [adoptSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { token } = await api.login(email, password);
      await adoptSession(email, token);
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    await sessionStore.clear();
    setState((prev) => ({ ...INITIAL, initialising: false, email: prev.email, stage: 'welcome' }));
  }, []);

  const saveProfile = useCallback(
    async (profile: Omit<Profile, 'businessName'> & { businessName?: string | null }) => {
      if (!state.token) throw new Error('Not signed in');
      const { profile: saved } = await api.saveProfile(state.token, profile);
      setState((prev) => ({ ...prev, profile: saved, stage: 'tasks' }));
    },
    [state.token],
  );

  const refreshSelectedTaskCount = useCallback(async () => {
    if (!state.token) return;
    try {
      const { totalSelected } = await api.selectedTasks(state.token);
      setState((prev) => ({ ...prev, selectedTaskCount: totalSelected }));
    } catch {
      // The Home screen has its own error state; a failed background refresh
      // should not replace it with a toast the user cannot act on.
    }
  }, [state.token]);

  const setSelectedTaskCount = useCallback((count: number) => {
    setState((prev) => ({ ...prev, selectedTaskCount: count, stage: count > 0 ? 'home' : 'tasks' }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setPendingEmail,
      completeVerification,
      login,
      logout,
      saveProfile,
      refreshSelectedTaskCount,
      setSelectedTaskCount,
      retryInitialLoad: loadSession,
    }),
    [
      state,
      setPendingEmail,
      completeVerification,
      login,
      logout,
      saveProfile,
      refreshSelectedTaskCount,
      setSelectedTaskCount,
      loadSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
