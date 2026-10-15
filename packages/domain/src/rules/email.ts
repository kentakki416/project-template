/**
 * email の大文字小文字と前後の空白の差をなくす。admins の照合と登録で同じ形にそろえる
 */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()
