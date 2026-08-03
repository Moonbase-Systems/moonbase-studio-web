import { useApi } from '#layers/core/app/composables/useApi';

import type {
  ForceChangePasswordPayload,
  ForceChangePasswordResponse,
  LoginPayload,
  LoginResponse,
  MeResponse,
  RegisterPayload,
  RegisterResponse,
} from '../models/auth-api.domain';
import type { AuthenticatedUser } from '../models/user.domain';

const AUTH_BASE = '/auth';

export const useAuthService = () => {
  const api = useApi();

  const login = (payload: LoginPayload) => api.post<LoginResponse>(`${AUTH_BASE}/login`, { body: payload });

  const register = (payload: RegisterPayload) =>
    api.post<RegisterResponse>(`${AUTH_BASE}/register`, { body: payload });

  const me = () => api.get<MeResponse>(`${AUTH_BASE}/me`);

  const logout = () => api.post<void>(`${AUTH_BASE}/logout`);

  const forceChangePassword = (payload: ForceChangePasswordPayload) =>
    api.post<ForceChangePasswordResponse>(`${AUTH_BASE}/force-change-password`, { body: payload });

  return {
    login,
    register,
    me,
    logout,
    forceChangePassword,
  };
};

export const mapMeToAuthenticatedUser = (me: MeResponse): AuthenticatedUser => ({
  id: me.id,
  email: me.email,
  firstName: me.firstName,
  lastName: me.lastName,
  role: me.role,
  permissions: me.permissions,
  isVerified: me.isVerified,
  isPasswordChangeRequired: me.isPasswordChangeRequired,
  createdAt: me.createdAt,
});
