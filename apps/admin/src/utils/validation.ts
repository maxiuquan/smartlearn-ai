/**
 * 验证邮箱
 */
export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * 验证手机号
 */
export function validatePhone(phone: string): boolean {
  const regex = /^1[3-9]\d{9}$/;
  return regex.test(phone);
}

/**
 * 验证密码强度
 * @returns 0-弱 1-中 2-强
 */
export function validatePasswordStrength(password: string): number {
  let strength = 0;
  
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

  return Math.min(strength, 2);
}

/**
 * 验证用户名
 */
export function validateUsername(username: string): boolean {
  const regex = /^[a-zA-Z0-9_]{3,20}$/;
  return regex.test(username);
}

/**
 * 验证URL
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
