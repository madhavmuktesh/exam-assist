export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  phone_number?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}