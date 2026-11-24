import { Request } from 'express';
import { TokenPayload } from '../config/jwt.js';

export interface AuthenticatedUser extends TokenPayload {
  officeType?: string | null;
  fuelStationCode?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
