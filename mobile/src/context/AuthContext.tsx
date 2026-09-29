import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import { sessionStore } from '../api/session';
import type { MeResponse, Profile } from '../api/types';

/**
 * Where a user is in the journey. The navigator switches on this:
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
  /**
   * True while the user is re-editing an existing selection from Home.
   *
   * The selection screen is the same screen either way, but "editing" changes
   * two behaviours: the primary action reads "Save changes" rather than
   * "Confirm selection", and navigating away is allowed without losing work.
   */
  editingSelection: boolean;
}

export interface AuthContextValue extends AuthState {
  /** Point the app at the OTP screen for an email that has not been verified. */
  setPendingEmail(email: string): void;
  /** Leave the OTP screen to correct a mistyped address. */
  cancelPendingEmail(): void;
  completeVerification(email: string, token: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  saveProfile(profile: Omit<Profile, 'businessName'> & { businessName?: string | null }): Promise<void>;
  refreshSelectedTaskCount(): Promise<void>;
  setSelectedTaskCount(count: number): void;
  /** Update the count without navigating. See `reportSelectedTaskCount`. */
  reportSelectedTaskCount(count: number): void;
  /** Enter the picker from Home *without* discarding the current selection. */
  beginEditSelection(): void;
  /** Leave the picker in edit mode without saving. */
  cancelEditSelection(): void;
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
  editingSelection: false,
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
        editingSelection: false,
      });
    } catch (err) {
      const apiErr = toApiError(err);
      // A rejected token is not a failure state — the user simply needs to sign
      // in again. Anything else (offline, server down) is worth showing.
      const tokenRejected =
        apiErr.code === 'TOKEN_EXPIRED' || apiErr.code === 'TOKEN_INVALID' || apiErr.code === 'AUTH_REQUIRED';

      if (tokenRejected) {
        await sessionStore.clear();
        setState((prev) => ({ ...INITIAL, initialising: false, email: prev.email }));
        return;
      }

      // Keep `stage: 'welcome'` so the Auth screen renders its error state with
      // a Retry. The token is held in memory only — if the user retries and it
      // works, the same token is reused; if they give up and log in, it is
      // replaced. It is never written to storage without a successful /me.
      setState((prev) => ({
        ...prev,
        initialising: false,
        stage: 'welcome',
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

  /**
   * Leave verification without a token. The address is forgotten too — keeping
   * it would mean the next register attempt re-uses a half-finished challenge
   * and the user would have to work out which code was current.
   */
  const cancelPendingEmail = useCallback(() => {
    setState((prev) => ({ ...prev, email: null, stage: 'welcome' }));
  }, []);

  /**
   * The order matters: verify first, persist second, transition last.
   *
   *   receive token -> GET /me -> confirm the session -> store the token ->
   *   move the app on
   *
   * Saving the token before `/me` succeeds meant a cold start could find a token
   * in AsyncStorage that the server had never accepted, and the user was stuck
   * in a boot loop with no way to tell why. Doing `/me` first means we only ever
   * persist a token the server has confirmed.
   */
  const adoptSession = useCallback(async (email: string, token: string) => {
    const session = await api.me(token);
    await sessionStore.saveToken(token);
    setState({
      stage: stageFor(session, true, null),
      initialising: false,
      email,
      token,
      profile: session.profile,
      selectedTaskCount: session.selectedTaskCount,
      initialLoadError: null,
      editingSelection: false,
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

  /**
   * Only a *confirmed* count may move the stage.
   *
   * The previous version applied the count as soon as a fetch resolved, which
   * meant a slow request could land after the user had already navigated and
   * yank them off the screen they were on. `selectedTaskCount` from a real
   * server response is the only thing that should drive routing.
   */
  const setSelectedTaskCount = useCallback((count: number) => {
    setState((prev) => {
      if (prev.initialising) return prev;
      const nextStage: AppStage = count > 0 ? 'home' : 'tasks';
      return { ...prev, selectedTaskCount: count, stage: nextStage, editingSelection: false };
    });
  }, []);

  /**
   * Record a count without moving the user.
   *
   * Home uses this for its own fetch. Routing from Home's load was what made the
   * empty state unreachable: arriving on Home with a stale count, fetching, and
   * getting back 0 switched the stage to `tasks` and unmounted Home before it
   * could render "no tasks yet" with a way out. Reporting the count keeps the
   * header accurate and leaves the decision with the user.
   */
  const reportSelectedTaskCount = useCallback((count: number) => {
    setState((prev) => (prev.selectedTaskCount === count ? prev : { ...prev, selectedTaskCount: count }));
  }, []);

  /**
   * Enter the picker from Home without touching the saved selection.
   *
   * This is the fix for the data-loss bug: "Edit" used to call
   * `PUT /api/tasks/selected` with an empty array, which really did delete every
   * saved task. If the user then backed out — or the app was killed — the tasks
   * were gone. Now the current selection is simply pre-loaded (the picker already
   * reads `selected` from the catalogue) and nothing is written until the user
   * confirms.
   */
  const beginEditSelection = useCallback(() => {
    setState((prev) => ({ ...prev, stage: 'tasks', editingSelection: true }));
  }, []);

  const cancelEditSelection = useCallback(() => {
    setState((prev) => ({ ...prev, stage: 'home', editingSelection: false }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setPendingEmail,
      cancelPendingEmail,
      completeVerification,
      login,
      logout,
      saveProfile,
      refreshSelectedTaskCount,
      setSelectedTaskCount,
      reportSelectedTaskCount,
      beginEditSelection,
      cancelEditSelection,
      retryInitialLoad: loadSession,
    }),
    [
      state,
      setPendingEmail,
      cancelPendingEmail,
      completeVerification,
      login,
      logout,
      saveProfile,
      refreshSelectedTaskCount,
      setSelectedTaskCount,
      reportSelectedTaskCount,
      beginEditSelection,
      cancelEditSelection,
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
