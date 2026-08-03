import type { AuthenticatedUser } from './user.domain';

export interface UserSessionState {
  user: AuthenticatedUser | null;
}

export function createEmptySessionState(): UserSessionState {
  return {
    user: null,
  };
}
