import type { Permission } from './layers/auth/app/models/user.domain';

declare module '#app' {
  interface PageMeta {
    title?: string;
    auth?: boolean | false;
    guestOnly?: boolean;
    requiredPermissions?: Permission[];
  }
}

export {};
