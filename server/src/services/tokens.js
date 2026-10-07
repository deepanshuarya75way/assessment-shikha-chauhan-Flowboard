import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
const hash =(t)=> crypto.createHash('sha256').update(t).digest('hex');
export const signAccessToken=(user)=>jwt.sign({sub: user.id.toString(),type:'access'},env.jwtSecret,{expiresIn:'1m'});
export const signRefreshToken=(user)=>jwt.sign({sub: user.id.toString(),type:'refresh'},env.jwtSecret,{expiresIn:'30d'});
export async  function issueTokens(user){
  const accessToken=signAccessToken(user);
  const refreshToken=signRefreshToken(user);
  user.refreshTokens.push(hash(refreshToken));
  if(user.refreshTokens.length>5) user.refreshTokens.shift();
  await user.save();
  return {accessToken , refreshToken};
}
export{hash};
