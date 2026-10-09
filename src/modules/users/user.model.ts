import { Schema, model, type HydratedDocument } from 'mongoose';

export interface User {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isBlocked: boolean;
  waitlistJoinedAt?: Date;
  waitlistSourceCode?: string;
  lastActivityAt: Date;
  firstSourceCode?: string;
  lastSourceCode?: string;
  receivedMaterialCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<User>(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    username: String,
    firstName: String,
    lastName: String,
    isBlocked: { type: Boolean, default: false },
    lastActivityAt: { type: Date, required: true, default: Date.now },
    waitlistJoinedAt: { type: Date, index: true },
    waitlistSourceCode: String,
    firstSourceCode: String,
    lastSourceCode: String,
    receivedMaterialCodes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<User>;
export const UserModel = model<User>('User', schema);
