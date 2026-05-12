export type UserRole = 'OWNER' | 'MANAGER' | 'RECEPTIONIST';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
