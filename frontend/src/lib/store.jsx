import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useZivv = () => useContext(Ctx);

export function ZivvProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('zivv_theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('zivv_theme', theme);
  }, [theme]);

  useEffect(() => {
    const boot = async () => {
      try {
        if (!localStorage.getItem('zivv_access')) { setUser(null); return; }
        const me = await api.get('/auth/me');
        setUser(me.data.user);
      } catch {
        localStorage.removeItem('zivv_access');
        localStorage.removeItem('zivv_refresh');
        setUser(null);
      } finally { setReady(true); }
    };
    boot();
  }, []);

  const saveSession = (data) => {
    localStorage.setItem('zivv_access', data.access);
    if (data.refresh) localStorage.setItem('zivv_refresh', data.refresh);
    setUser(data.user);
  };
  const login = async (fields) => {
    const { data } = await api.post('/auth/login', fields);
    saveSession(data);
  };
  const register = async (fields) => {
    const { data } = await api.post('/auth/register', fields);
    saveSession(data);
  };
  const refreshUser = async () => {
    try { const me = await api.get('/auth/me'); setUser(me.data.user); } catch {}
  };
  const logout = () => {
    localStorage.removeItem('zivv_access');
    localStorage.removeItem('zivv_refresh');
    sessionStorage.removeItem('zivv_king_entry');
    localStorage.removeItem('zivv_admin');
    location.href = '/login';
  };

  return <Ctx.Provider value={{ user, setUser, ready, theme, setTheme, login, register, refreshUser, logout }}>{children}</Ctx.Provider>;
}
