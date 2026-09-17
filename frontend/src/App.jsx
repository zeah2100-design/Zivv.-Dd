import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ZivvProvider } from './lib/store';
import Layout from './components/Layout';
import Home from './pages/Home';
import Reels from './pages/Reels';
import Search from './pages/Search';
import Create from './pages/Create';
import Profile from './pages/Profile';
import { ChatList, ChatRoom } from './pages/Chat';
import PrivateChat from './pages/PrivateChat';
import Friends from './pages/Friends';
import AI from './pages/AI';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import { Marketplace, ProductDetail } from './pages/Marketplace';
import Ads from './pages/Ads';
import Gold from './pages/Gold';
import King from './pages/King';
import Login from './pages/Login';

export default function App() {
  return (
    <ZivvProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/search" element={<Search />} />
            <Route path="/create" element={<Create />} />
            <Route path="/u/:username" element={<Profile />} />
            <Route path="/chat" element={<ChatList />} />
            <Route path="/chat/:id" element={<ChatRoom />} />
            <Route path="/private" element={<PrivateChat />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/ai" element={<AI />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/market" element={<Marketplace />} />
            <Route path="/market/:id" element={<ProductDetail />} />
            <Route path="/ads" element={<Ads />} />
            <Route path="/gold" element={<Gold />} />
            <Route path="/king" element={<King />} />
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ZivvProvider>
  );
}
