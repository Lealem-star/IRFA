import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'irfa_bahir_dar_super_secret_jwt_key_2026_secured';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '8h') as string;

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  fullName: string;
  officeId?: string | null;
  fuelStationId?: string | null;
}

export const signToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};
