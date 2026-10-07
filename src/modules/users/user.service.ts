import { UserRepository, type TelegramUserInput } from './user.repository.js';

export class UserService {
  constructor(private readonly users = new UserRepository()) {}
  touch(user: TelegramUserInput) {
    return this.users.upsertFromTelegram(user);
  }
  findByTelegramId(id: string) {
    return this.users.findByTelegramId(id);
  }
}
