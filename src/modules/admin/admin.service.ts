import { UserRepository } from '../users/user.repository.js';
import { SubscriptionRepository } from '../subscriptions/subscription.repository.js';
import { PaymentRepository } from '../payments/payment.repository.js';
export class AdminService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly subscriptions = new SubscriptionRepository(),
    private readonly payments = new PaymentRepository(),
  ) {}
  async stats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [users, active, succeeded, revenue, newToday, paidToday] = await Promise.all([
      this.users.count(),
      this.subscriptions.countActive(),
      this.payments.countSucceeded(),
      this.payments.revenue(),
      this.users.countCreatedSince(today),
      this.payments.countSucceededSince(today),
    ]);
    return { users, active, succeeded, revenue: revenue[0]?.total ?? 0, newToday, paidToday };
  }
  latestUsers() {
    return this.users.listLatest();
  }
  latestPayments() {
    return this.payments.listLatest();
  }
  pendingMockPayments() {
    return this.payments.listPendingMock();
  }
}
