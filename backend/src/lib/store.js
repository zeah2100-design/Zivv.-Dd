// In-memory demo store. Production uses Prisma (see prisma/schema.prisma).
// This lets the app boot + preview with zero infra, then swap to Postgres transparently.
const { v4: uuid } = require('uuid');

const now = () => new Date().toISOString();
const H = (h = 0) => new Date(Date.now() - h * 3600e3).toISOString();

const users = [
  { id: 'u-layla', name: 'Layla Hassan', username: 'layla', avatar: null, bio: 'Football • Reels • Cairo ⚽', followers: 128400, following: 312, verified: true, gold: true },
  { id: 'u-omar', name: 'Omar Farouk', username: 'omar.codes', avatar: null, bio: 'Programming tutorials — Arabic + English', followers: 89200, following: 180, verified: true, gold: false },
  { id: 'u-nour', name: 'Nour El-Din', username: 'nour.music', avatar: null, bio: 'Calm music 🎧 New track every Friday', followers: 45200, following: 96, verified: false, gold: true },
  { id: 'u-you', name: 'You', username: 'you', avatar: null, bio: 'Welcome to ZIVV ✦', followers: 12, following: 3, verified: false, gold: false },
];

const posts = [
  { id: 'p1', authorId: 'u-layla', type: 'VIDEO', text: 'Top 5 dribbling drills you can do at home ⚽🔥', hashtags: ['football', 'training'], mentions: [], likeCount: 4821, commentCount: 214, shareCount: 390, saveCount: 1200, aiGenerated: false, createdAt: H(2), media: [{ kind: 'VIDEO', cdnUrl: '', durationSec: 184 }] },
  { id: 'p2', authorId: 'u-omar', type: 'TEXT', text: 'Learn programming in 2026 — my roadmap: 1) Python basics 2) Build 5 projects 3) Git + GitHub 4) One framework deeply. Save this.', hashtags: ['programming', 'coding'], mentions: [], likeCount: 3102, commentCount: 187, shareCount: 900, saveCount: 3400, aiGenerated: false, createdAt: H(5), media: [] },
  { id: 'p3', authorId: 'u-nour', type: 'MUSIC', text: 'New calm piano track — "Midnight Nile" 🎹', hashtags: ['music', 'calm'], mentions: [], likeCount: 1950, commentCount: 96, shareCount: 210, saveCount: 800, aiGenerated: false, createdAt: H(9), media: [{ kind: 'AUDIO', cdnUrl: '', durationSec: 203 }] },
  { id: 'p4', authorId: 'u-layla', type: 'IMAGE', text: 'Match day fit 📸', hashtags: ['football', 'style'], mentions: [], likeCount: 1204, commentCount: 44, shareCount: 30, saveCount: 90, aiGenerated: false, createdAt: H(26), media: [{ kind: 'IMAGE', cdnUrl: '' }] },
];

const reels = [
  { id: 'r1', authorId: 'u-layla', caption: 'POV: last-minute skills 😮‍💨', hashtags: ['football', 'skills'], sound: { title: 'Energy Beat', artist: 'ZIVV Sounds', uses: 18200 }, durationSec: 24, likeCount: 98200, commentCount: 1204, shareCount: 8300, playCount: 1200000, createdAt: H(1) },
  { id: 'r2', authorId: 'u-omar', caption: 'CSS in 20 seconds 👀', hashtags: ['programming', 'css'], sound: { title: 'Lo-Fi Focus', artist: 'Nour', uses: 9400 }, durationSec: 19, likeCount: 45200, commentCount: 640, shareCount: 2100, playCount: 640000, createdAt: H(4) },
  { id: 'r3', authorId: 'u-nour', caption: 'Calm mornings 🌅', hashtags: ['calm', 'music'], sound: { title: 'Midnight Nile', artist: 'Nour El-Din', uses: 3200 }, durationSec: 31, likeCount: 21800, commentCount: 290, shareCount: 1400, playCount: 310000, createdAt: H(12) },
];

const listings = [
  { id: 'm1', sellerId: 'u-omar', title: 'iPhone 13 — 128GB, excellent', priceCents: 3850000, currency: 'EGP', condition: 'used-like-new', category: 'Phones', status: 'available', phonePublic: false, description: 'Battery 89%. Box + cable. Meet in Giza / Dokki.', createdAt: H(6) },
  { id: 'm2', sellerId: 'u-layla', title: 'Nike football boots (size 42)', priceCents: 290000, currency: 'EGP', condition: 'new', category: 'Sports', status: 'available', phonePublic: true, description: 'Brand new with box.', createdAt: H(30) },
];

const conversations = [
  { id: 'c1', title: null, members: ['u-you', 'u-layla'], lastMessage: 'See you at the match! ⚽', unread: 2, online: true, typing: false, updatedAt: H(0.2), private: false },
  { id: 'c2', title: null, members: ['u-you', 'u-omar'], lastMessage: 'Sent you the roadmap 👍', unread: 0, online: false, typing: false, updatedAt: H(3), private: false },
];
const messages = {
  c1: [
    { id: 'm1', senderId: 'u-layla', kind: 'text', text: 'Hey! Did you see the new reel? 👀', createdAt: H(1), state: 'read' },
    { id: 'm2', senderId: 'u-you', kind: 'text', text: 'Yes! That last skill was insane 🔥', createdAt: H(0.9), state: 'read' },
    { id: 'm3', senderId: 'u-layla', kind: 'text', text: 'See you at the match! ⚽', createdAt: H(0.2), state: 'delivered' },
  ],
  c2: [{ id: 'm1', senderId: 'u-omar', kind: 'text', text: 'Sent you the roadmap 👍', createdAt: H(3), state: 'read' }],
};

const notifications = [
  { id: 'n1', category: 'social', title: 'Layla Hassan liked your comment', body: '“That last skill was insane 🔥”', read: false, createdAt: H(0.5) },
  { id: 'n2', category: 'social', title: 'New follower', body: 'omar.codes started following you', read: false, createdAt: H(2) },
  { id: 'n3', category: 'ai', title: 'AI task completed', body: 'Your reel captions are ready', read: true, createdAt: H(7) },
  { id: 'n4', category: 'system', title: 'New login', body: 'Chrome • Giza, Egypt', read: true, createdAt: H(20) },
];

const friendRequests = [
  { id: 'f1', fromId: 'u-omar', toId: 'u-you', status: 'PENDING', mutual: 12, createdAt: H(4) },
  { id: 'f2', fromId: 'u-nour', toId: 'u-you', status: 'PENDING', mutual: 5, createdAt: H(9) },
];

const campaigns = [
  { id: 'ad1', title: 'Boost: Dribbling drills reel', status: 'ACTIVE', budgetCents: 50000, impressions: 48200, clicks: 1904, createdAt: H(50) },
];
const goldPackages = [
  { id: 'g1', name: 'Gold Monthly', priceCents: 19900, durationDays: 30, perks: ['Gold badge', 'Premium profile', 'Priority AI', 'Exclusive themes', 'Priority support'] },
  { id: 'g2', name: 'Gold Yearly', priceCents: 199000, durationDays: 365, perks: ['Everything in Monthly', 'Early features', 'Enhanced chat', '2× AI quota'] },
];

const sounds = [
  { id: 's1', title: 'Energy Beat', artist: 'ZIVV Sounds', uses: 18200 },
  { id: 's2', title: 'Lo-Fi Focus', artist: 'Nour', uses: 9400 },
  { id: 's3', title: 'Midnight Nile', artist: 'Nour El-Din', uses: 3200 },
];

const aiChats = [{ id: 'a1', title: 'Football reel ideas', messages: [
  { id: 'x1', role: 'user', text: 'Give me 3 reel ideas about football dribbling' },
  { id: 'x2', role: 'assistant', text: '1) “5 drills in 25 seconds” fast-cut tutorial ⚽\n2) POV street-dribbling with trending sound\n3) Before/after: 7 days of practice — film day 1 today!' },
]}];

module.exports = {
  uuid, now, users, posts, reels, listings, conversations, messages,
  notifications, friendRequests, campaigns, goldPackages, sounds, aiChats,
};
