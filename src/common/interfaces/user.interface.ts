export interface IUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  agreesToTerms: boolean;
  termsAgreedAt?: Date;
  termsVersion: string;
  profileCompleted: boolean;
  dateJoined: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserProfile {
  id: number;
  userId: number;
  phoneNumber?: string;
  dateOfBirth?: Date;
  bio?: string;
  avatar?: string;
  emailNotifications: boolean;
  marketingEmails: boolean;
  city?: string;
  state?: string;
  country: string;
  traderSince: Date;
  tradingRating: number;
  totalTrades: number;
  successfulTrades: number;
  isVerifiedTrader: boolean;
  traderTier: string;
  specialties?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserWithProfile extends IUser {
  profile?: IUserProfile;
}

export interface IJwtPayload {
  sub: number;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthResponse {
  user: IUserWithProfile;
  tokens: IAuthTokens;
}
