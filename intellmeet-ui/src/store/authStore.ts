import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Check if a token already exists in the browser's memory when the app loads
  token: localStorage.getItem('token'),
  
  setToken: (token) => {
    localStorage.setItem('token', token); // Save to browser
    set({ token }); // Save to Zustand state
  },
  
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null });
  },
}));