import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 25000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('zivv_access');
  if (t && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.status === 401 && !cfg._retried && !cfg.url?.includes('/auth/')) {
      cfg._retried = true;
      try {
        const refresh = localStorage.getItem('zivv_refresh');
        if (!refresh) throw new Error('no_refresh');
        const { data } = await axios.post('/api/auth/refresh', { refresh });
        localStorage.setItem('zivv_access', data.access);
        cfg.headers.Authorization = `Bearer ${data.access}`;
        return api(cfg);
      } catch {
        localStorage.removeItem('zivv_access');
        localStorage.removeItem('zivv_refresh');
        if (!location.pathname.startsWith('/login')) location.href = '/login';
      }
    }
    throw err;
  }
);

export default api;
export const fmt = {
  n: (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(v ?? 0)),
  time: (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    return Math.floor(s / 86400) + 'd';
  },
  money: (cents, cur = 'EGP') => new Intl.NumberFormat('en-EG', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format((cents || 0) / 100),
};
