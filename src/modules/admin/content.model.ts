import type { MessageEntity } from 'grammy/types';
import { Schema, model } from 'mongoose';

export interface ContentMessage {
  chatId: number;
  messageId: number;
  kind: string;
  text?: string;
  caption?: string;
  entities?: MessageEntity[] | undefined;
  captionEntities?: MessageEntity[] | undefined;
}

const messageSchema = new Schema<ContentMessage>(
  {
    chatId: { type: Number, required: true },
    messageId: { type: Number, required: true },
    kind: { type: String, required: true },
    text: String,
    caption: String,
    entities: { type: [Schema.Types.Mixed], default: undefined },
    captionEntities: { type: [Schema.Types.Mixed], default: undefined },
  },
  { _id: false },
);

export interface Material {
  code: string;
  title: string;
  note?: string;
  messages: ContentMessage[];
  inviteText?: string;
  inviteButton?: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const materialSchema = new Schema<Material>(
  {
    code: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    note: String,
    messages: { type: [messageSchema], default: [] },
    inviteText: String,
    inviteButton: String,
    published: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const MaterialModel = model<Material>('Material', materialSchema);

export interface BroadcastDraft {
  ownerId: string;
  messages: ContentMessage[];
  audience: string;
  includeJoinButton: boolean;
  status: 'draft' | 'sending' | 'done';
  recipientIds: string[];
  cursor: number;
  sent: number;
  failed: number;
  blocked: number;
  createdAt: Date;
  updatedAt: Date;
}
const broadcastSchema = new Schema<BroadcastDraft>(
  {
    ownerId: { type: String, required: true, index: true },
    messages: { type: [messageSchema], default: [] },
    audience: { type: String, default: 'all' },
    includeJoinButton: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'sending', 'done'], default: 'draft' },
    recipientIds: { type: [String], default: [] },
    cursor: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const BroadcastDraftModel = model<BroadcastDraft>('BroadcastDraft', broadcastSchema);

export interface AdminDialog {
  adminId: string;
  mode: string;
  targetId?: string;
  index?: number;
  updatedAt: Date;
}
const dialogSchema = new Schema<AdminDialog>(
  {
    adminId: { type: String, required: true, unique: true },
    mode: { type: String, required: true },
    targetId: String,
    index: Number,
  },
  { timestamps: true },
);
export const AdminDialogModel = model<AdminDialog>('AdminDialog', dialogSchema);
