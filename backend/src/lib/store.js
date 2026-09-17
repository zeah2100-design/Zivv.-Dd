// In-memory store. NOTE: serverless instances don't share memory —
// accounts + content live per-instance until Postgres is connected.
// No seed/fake data: the app starts clean and users create everything.
const { v4: uuid } = require('uuid');

const now = () => new Date().toISOString();

const users = [];           // {id,firstName,lastName,name,username,email,age,bio,avatar,followers,following,verified,gold,points,banned,role,_pw}
const posts = [];           // {id,authorId,type,text,hashtags,media,likeCount,commentCount,shareCount,saveCount,viewCount,viewBonusPaid,aiGenerated,createdAt}
const reels = [];           // {id,authorId,caption,hashtags,mediaUrl,sound,durationSec,likeCount,commentCount,shareCount,playCount,createdAt}
const listings = [];
const conversations = [];
const messages = {};        // convId -> [{id,senderId,kind:'text'|'audio',text,audio,createdAt,state}]
const notifications = [];   // {id,userId|null(broadcast),category,title,body,read,createdAt}
const friendRequests = [];
const campaigns = [];       // ads {id,userId,title,...,status}
const goldRequests = [];    // {id,userId,package,status,createdAt}
const audit = [];           // admin actions
const goldPackages = [
  { id: 'g1', name: 'Gold Monthly', priceCents: 19900, durationDays: 30, perks: ['Gold badge', 'Voice AI chat', 'AI agent actions', '5000-char posts', 'Priority AI', 'Exclusive profile ring'] },
  { id: 'g2', name: 'Gold Yearly', priceCents: 199000, durationDays: 365, perks: ['Everything in Monthly', 'Early features', 'Enhanced chat', '2× AI quota'] },
];
const sounds = [];
const aiChats = [];         // {id,userId,title,pinned,messages:[{id,role,text}]}

function notify(userId, { category = 'system', title, body }) {
  const n = { id: 'n' + Date.now() + Math.floor(Math.random() * 1e4), userId, category, title, body, read: false, createdAt: now() };
  notifications.unshift(n);
  return n;
}

function auditLog(by, action, target) {
  audit.unshift({ id: 'a' + Date.now() + Math.floor(Math.random() * 1e4), by, action, target: target || '', at: now() });
}

module.exports = {
  uuid, now, users, posts, reels, listings, conversations, messages,
  notifications, friendRequests, campaigns, goldRequests, audit,
  goldPackages, sounds, aiChats, notify, auditLog,
};
