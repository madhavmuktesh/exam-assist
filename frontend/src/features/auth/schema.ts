export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  confirm_password: string;
}

export interface ChangePasswordFormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}