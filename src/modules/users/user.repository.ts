import { UserModel } from './user.model.js';

export interface TelegramUserInput {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}

export class UserRepository {
  upsertFromTelegram(user: TelegramUserInput) {
    return UserModel.findOneAndUpdate(
      { telegramId: String(user.id) },
      {
        $set: {
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          lastActivityAt: new Date(),
          isBlocked: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).orFail();
  }
  findByTelegramId(telegramId: string) {
    return UserModel.findOne({ telegramId });
  }
  listLatest(limit = 10) {
    return UserModel.find().sort({ createdAt: -1 }).limit(limit);
  }
  count() {
    return UserModel.countDocuments();
  }
  countCreatedSince(date: Date) {
    return UserModel.countDocuments({ createdAt: { $gte: date } });
  }
  listAll() {
    return UserModel.find().cursor();
  }
  markBlocked(telegramId: string) {
    return UserModel.updateOne({ telegramId }, { $set: { isBlocked: true } });
  }
}
