import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useZivv = () => useContext(Ctx);

export function ZivvProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('zivv_theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('zivv_theme', theme);
  }, [theme]);

  useEffect(() => {
    const boot = async () => {
      try {
        // Production has no demo backdoor: provision a session on first visit.
        if (!localStorage.getItem('zivv_access')) {
          const { data } = await api.post('/auth/login', { username: 'you', password: '' });
          if (data.access) localStorage.setItem('zivv_access', data.access);
        }
        const me = await api.get('/auth/me');
        setUser(me.data.user);
      } catch { setUser({ id: 'u-you', name: 'You', username: 'you' }); }
    };
    boot();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('zivv_access', data.access);
    setUser(data.user);
  };
  const logout = () => { localStorage.removeItem('zivv_access'); location.href = '/login'; };

  return <Ctx.Provider value={{ user, setUser, theme, setTheme, login, logout }}>{children}</Ctx.Provider>;
}
