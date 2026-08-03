import type { AuthenticatedUser } from './user.domain';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ForceChangePasswordPayload {
  email: string;
  temporaryPassword: string;
  newPassword: string;
}

export interface LoginSuccessResponse {
  token: string;
  user: Pick<AuthenticatedUser, 'id' | 'email' | 'role' | 'isVerified' | 'isPasswordChangeRequired'>;
}

export interface PasswordChangeRequiredResponse {
  message: 'PASSWORD_CHANGE_REQUIRED';
  email: string;
}

export type LoginResponse = LoginSuccessResponse | PasswordChangeRequiredResponse;

export interface RegisterResponse {
  id: string;
  email: string;
  isVerified: boolean;
  isPasswordChangeRequired: boolean;
}

export type MeResponse = AuthenticatedUser;

export interface ForceChangePasswordResponse {
  token: string;
  user: Pick<AuthenticatedUser, 'id' | 'email' | 'role' | 'isPasswordChangeRequired'>;
}

export function isPasswordChangeRequiredResponse(
  response: LoginResponse,
): response is PasswordChangeRequiredResponse {
  return 'message' in response && response.message === 'PASSWORD_CHANGE_REQUIRED';
}
