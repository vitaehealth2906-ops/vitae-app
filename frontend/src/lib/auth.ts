export interface UserData {
  id: string;
  nome: string;
  email: string;
  celular?: string;
  fotoUrl?: string;
}

export function salvarAuth(token: string, refreshToken: string, usuario: UserData) {
  localStorage.setItem('vitae_token', token);
  localStorage.setItem('vitae_refresh_token', refreshToken);
  localStorage.setItem('vitae_user', JSON.stringify(usuario));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vitae_token');
}

export function getUser(): UserData | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('vitae_user');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('vitae_token');
  localStorage.removeItem('vitae_refresh_token');
  localStorage.removeItem('vitae_user');
  window.location.href = '/cadastro';
}
