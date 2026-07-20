export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateLoginForm(email: string, password: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!email.trim()) errors.push({ field: "email", message: "Email is required" });
  else if (!isValidEmail(email)) errors.push({ field: "email", message: "Invalid email address" });
  if (!password) errors.push({ field: "password", message: "Password is required" });
  return errors;
}

export function validateRegisterForm(
  fullName: string,
  email: string,
  phone: string,
  password: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!fullName.trim()) errors.push({ field: "full_name", message: "Full name is required" });
  if (!email.trim()) errors.push({ field: "email", message: "Email is required" });
  else if (!isValidEmail(email)) errors.push({ field: "email", message: "Invalid email address" });
  if (!phone.trim()) errors.push({ field: "phone_number", message: "Phone number is required" });
  else if (!isValidPhone(phone)) errors.push({ field: "phone_number", message: "Enter a valid 10-digit Indian phone number" });
  if (!password) errors.push({ field: "password", message: "Password is required" });
  else if (!isStrongPassword(password)) errors.push({ field: "password", message: "Password must be at least 8 characters" });
  return errors;
}