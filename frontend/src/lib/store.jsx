import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useZivv = () => useContext(Ctx);

export function ZivvProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('zivv_theme') || 'dark');
  const [lang, setLang] = useState(localStorage.getItem('zivv_lang') || 'en');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('zivv_theme', theme);
  }, [theme]);

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser({ id: 'u-you', name: 'You', username: 'you' }));
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('zivv_access', data.access);
    setUser(data.user);
  };
  const logout = () => { localStorage.removeItem('zivv_access'); location.href = '/login'; };

  return <Ctx.Provider value={{ user, setUser, theme, setTheme, lang, setLang, login, logout }}>{children}</Ctx.Provider>;
}
