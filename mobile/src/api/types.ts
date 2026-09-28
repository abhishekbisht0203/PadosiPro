/**
 * Shapes returned by the backend. Kept in one file so a contract change shows
 * up as one typecheck error rather than a scattering of `any`s.
 */

export interface ApiUser {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Profile {
  name: string;
  mobile: string;
  address: string;
  businessName: string | null;
}

export interface Task {
  id: number;
  slug: string;
  name: string;
  categoryId: string;
  subcategory: string;
  description: string;
  icon: string;
  selected?: boolean;
}

export interface TaskCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tasks: Task[];
}

export interface SelectedTask extends Task {
  categoryTitle: string;
  selectedAt?: string;
}

export interface SessionResponse {
  token: string;
  user: ApiUser;
}

export interface MeResponse {
  user: ApiUser;
  profile: Profile | null;
  hasCompletedProfile: boolean;
  selectedTaskCount: number;
}

export interface RegisterResponse {
  email: string;
  isNewAccount: boolean;
  codeResent: boolean;
  nextStep: 'verify_email';
}

export interface TaskSelectionResponse {
  tasks: SelectedTask[];
  totalSelected: number;
}
