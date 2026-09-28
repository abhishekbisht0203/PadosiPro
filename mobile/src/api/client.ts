import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ApiError, toApiError } from './errors';
import type {
  MeResponse,
  Profile,
  RegisterResponse,
  SessionResponse,
  TaskCategory,
  TaskSelectionResponse,
} from './types';

/**
 * Where the API lives.
 *
 * Defaults to `10.0.2.2` on Android because that is how the Android emulator
 * reaches the host machine; a physical device needs your machine's LAN IP, so
 * set EXPO_PUBLIC_API_URL before running the app. See README "Pointing the app
 * at your backend".
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';

  // On the iOS simulator localhost reaches the host, and on Expo Go the packager
  // host is the machine running Metro.
  if (Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    if (host) return `http://${host}:4000`;
  }
  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveBaseUrl();

const TIMEOUT_MS = 15_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Allow a caller to cancel, e.g. when a screen unmounts mid-request.
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'The server took too long to respond. Check your connection and try again.');
    }
    throw new ApiError(
      'NETWORK_ERROR',
      `Could not reach the server at ${API_BASE_URL}. Make sure the backend is running.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError('BAD_RESPONSE', 'The server sent a response the app could not read.', response.status);
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, string>; meta?: Record<string, number> } })?.error;
    throw new ApiError(
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      error?.details ?? {},
      error?.meta?.retryAfterSeconds,
    );
  }

  return (payload as { data: T })?.data as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<RegisterResponse>('/api/auth/register', { method: 'POST', body: { email, password } }),

  verifyOtp: (email: string, code: string) =>
    request<SessionResponse>('/api/auth/verify-otp', { method: 'POST', body: { email, code } }),

  resendOtp: (email: string) =>
    request<{ email: string }>('/api/auth/resend-otp', { method: 'POST', body: { email } }),

  login: (email: string, password: string) =>
    request<SessionResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),

  me: (token: string, signal?: AbortSignal) => request<MeResponse>('/api/auth/me', { token, signal }),

  saveProfile: (token: string, profile: Omit<Profile, 'businessName'> & { businessName?: string | null }) =>
    request<{ profile: Profile; nextStep: string }>('/api/profile', { method: 'PUT', body: profile, token }),

  tasks: (token: string, signal?: AbortSignal) =>
    request<{ categories: TaskCategory[]; totalTasks: number }>('/api/tasks', { token, signal }),

  selectedTasks: (token: string) => request<TaskSelectionResponse>('/api/tasks/selected', { token }),

  saveSelectedTasks: (token: string, taskIds: number[]) =>
    request<TaskSelectionResponse>('/api/tasks/selected', { method: 'PUT', body: { taskIds }, token }),

  meta: () => request<{ categories: number; tasks: number }>('/api/meta'),
};

export { ApiError, toApiError };
