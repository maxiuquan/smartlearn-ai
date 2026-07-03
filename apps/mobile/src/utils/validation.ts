export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('密码至少8个字符');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码需包含大写字母');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码需包含小写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码需包含数字');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateUsername = (username: string): boolean => {
  return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>'"]/g, '');
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};
