import { z } from 'zod';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { ApiError, asyncHandler } from '../middleware/error.js';
import { signToken } from '../middleware/auth.js';
import { issueTokens,signAccessToken,hash } from '../services/tokens.js';
import jwt from 'jsonwebtoken';
import{env} from '../config/env.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw ApiError.conflict('That email is already registered');

  const user = await User.create({ name, email, password });

  // Give new accounts somewhere to start.
  await Workspace.create({
    name: `${name.split(' ')[0]}'s workspace`,
    description: 'Your personal workspace',
    owner: user._id,
    members: [{ user: user._id, role: 'admin' }],
  });

  res.status(201).json({ user, ...tokens,token: tokens.accessToken });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  // Same message either way so the endpoint cannot be used to enumerate emails.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email or password is incorrect');
  }
  const tokens =await issueTokens(user);

  

  // res.json({ user: user.toJSON(), token: signToken(user) });
  res.json({ user: user.toJSON(), ...tokens,token:tokens.accessToken });
});

export const refresh =asyncHandler(async (req,res)=>{
  const {refreshToken}=req.body;
  if(!refreshToken) throw ApiError.unauthorized('missing refresh token  ');
  let payload;
  try{ payload=jwt.verify(refreshToken , env.jwtSecret);}
  catch{
    throw ApiError.unauthorized('session expired .sign in again');
  }
  if (payload.type!=='refresh') throw ApiError.unauthorized('Invalid Token');
  const user=await User.findById(payload.sub);
  const TokenHash=hash(refreshToken);
  if (!user || !user.refreshTokens.includes(TokenHash)){
    throw ApiError.unauthorized('Session expired sign in again');
  }
  user.refreshTokens=user.refreshTokens.filter((t)=>t!==tokenHash);
  const tokens =await issueTokens(user);
  res.json({...tokens,token:tokens.accessToken});
});
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  title: z.string().trim().max(80).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const updateProfile = asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user });
});

// Tokens are stateless, so logout is a client-side token drop. The endpoint
// exists so the client has one place to hook in revocation later.
// export const logout = (req, res) => res.json({ ok: true });
export const logout =asyncHandler(async(req,res)=>{
  if( req.body.refreshToken){
    const tokenHash=hash(req.body.refreshToken);
    await User.updateOne({_id:req.user._id},{$pull:{refreshTokens:tokenHash}});
  }
  res.json({ok:true});

});

export const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [] });

  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).limit(10);
  res.json({ users });
});
