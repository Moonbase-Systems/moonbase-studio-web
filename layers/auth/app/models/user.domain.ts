export const PERMISSIONS = {
  VIEW_ADMIN_PANEL: 'VIEW_ADMIN_PANEL',
  USERS_READ: 'USERS_READ',
  USERS_WRITE: 'USERS_WRITE',
  USERS_DELETE: 'USERS_DELETE',
  ROLES_READ: 'ROLES_READ',
  ROLES_WRITE: 'ROLES_WRITE',
  AUDIT_READ: 'AUDIT_READ',
  SETTINGS_READ: 'SETTINGS_READ',
  SETTINGS_WRITE: 'SETTINGS_WRITE',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface UserRole {
  id: number;
  name: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole | null;
  permissions: Permission[];
  isVerified?: boolean;
  isPasswordChangeRequired?: boolean;
  createdAt?: string;
}
