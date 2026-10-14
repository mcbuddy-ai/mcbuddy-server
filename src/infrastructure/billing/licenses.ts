import { GrantModel, type LicenseDocument, LicenseModel, PaymentModel } from "../../entities/license/license.model";

export type LicenseRecord = LicenseDocument;

export interface GrantRecord {
  id: string;
  license: string;
  payment?: string;
  budget: number;
  spent: number;
  starts: Date;
  ends: Date;
}

export interface PaymentRecord {
  charge_id: string;
  license: string;
  plan: string;
  stars: number;
  telegram_user_id: number;
  at: Date;
  recurring: boolean;
  refunded_at?: Date;
}

/** Licenses, their budget windows, and the payments that opened them. MongoDB, next to the memories. */
export interface LicenseStore {
  create(license: LicenseRecord): Promise<void>;
  get(id: string): Promise<LicenseRecord | null>;
  update(id: string, patch: Partial<LicenseRecord>): Promise<void>;
  /** Takes a claim code once: returns its license and forgets the code, or null when it's unknown or expired. */
  claim(claimHash: string, now: Date): Promise<LicenseRecord | null>;
  ofTelegram(userId: number): Promise<LicenseRecord[]>;
  grants(license: string): Promise<GrantRecord[]>;
  /** Records a payment with its windows; false when this charge was already counted. */
  pay(payment: PaymentRecord, grants: Array<Omit<GrantRecord, "id" | "spent" | "license" | "payment">>): Promise<boolean>;
  payment(chargeId: string): Promise<PaymentRecord | null>;
  /** Marks a payment refunded and closes the windows it opened. */
  refund(chargeId: string, at: Date): Promise<PaymentRecord | null>;
  charge(grantId: string, usd: number): Promise<void>;
}

const id = () => crypto.randomUUID().replace(/-/g, "");

const grantRecord = (g: GrantRecord): GrantRecord => ({
  id: g.id,
  license: g.license,
  payment: g.payment,
  budget: g.budget,
  spent: g.spent,
  starts: g.starts,
  ends: g.ends,
});

export const mongoLicenses: LicenseStore = {
  async create(license) {
    await LicenseModel.create(license);
  },
  async get(licenseId) {
    return LicenseModel.findOne({ id: licenseId }).lean<LicenseRecord>();
  },
  async update(licenseId, patch) {
    await LicenseModel.updateOne({ id: licenseId }, { $set: patch });
  },
  async claim(claimHash, now) {
    return LicenseModel.findOneAndUpdate(
      { claim_hash: claimHash, claim_expires: { $gt: now } },
      { $unset: { claim_hash: 1, claim_expires: 1 } },
      { returnDocument: "after" },
    ).lean<LicenseRecord>();
  },
  async ofTelegram(userId) {
    return LicenseModel.find({ telegram_user_id: userId }).sort({ created_at: 1 }).lean<LicenseRecord[]>();
  },
  async grants(license) {
    return (await GrantModel.find({ license }).lean<GrantRecord[]>()).map(grantRecord);
  },
  async pay(payment, grants) {
    try {
      await PaymentModel.create(payment);
    } catch (error) {
      // The unique charge id: Telegram delivered this payment twice.
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
    await GrantModel.insertMany(grants.map((g) => ({ ...g, id: id(), license: payment.license, payment: payment.charge_id, spent: 0 })));
    return true;
  },
  async payment(chargeId) {
    return PaymentModel.findOne({ charge_id: chargeId }).lean<PaymentRecord>();
  },
  async refund(chargeId, at) {
    const payment = await PaymentModel.findOneAndUpdate(
      { charge_id: chargeId, refunded_at: { $exists: false } },
      { $set: { refunded_at: at } },
      { returnDocument: "after" },
    ).lean<PaymentRecord>();
    if (payment) await GrantModel.deleteMany({ payment: chargeId });
    return payment;
  },
  async charge(grantId, usd) {
    await GrantModel.updateOne({ id: grantId }, { $inc: { spent: usd } });
  },
};

/** For tests and local runs without MongoDB. */
export const memoryLicenses = (): LicenseStore => {
  const licenses = new Map<string, LicenseRecord>();
  const grants: GrantRecord[] = [];
  const payments = new Map<string, PaymentRecord>();
  return {
    async create(license) {
      licenses.set(license.id, { ...license });
    },
    async get(licenseId) {
      const license = licenses.get(licenseId);
      return license ? { ...license } : null;
    },
    async update(licenseId, patch) {
      const license = licenses.get(licenseId);
      if (license) licenses.set(licenseId, { ...license, ...patch });
    },
    async claim(claimHash, now) {
      const license = [...licenses.values()].find((l) => l.claim_hash === claimHash && l.claim_expires && l.claim_expires > now);
      if (!license) return null;
      const { claim_hash: _, claim_expires: __, ...rest } = license;
      licenses.set(license.id, rest);
      return { ...rest };
    },
    async ofTelegram(userId) {
      return [...licenses.values()].filter((l) => l.telegram_user_id === userId).map((l) => ({ ...l }));
    },
    async grants(license) {
      return grants.filter((g) => g.license === license).map((g) => ({ ...g }));
    },
    async pay(payment, windows) {
      if (payments.has(payment.charge_id)) return false;
      payments.set(payment.charge_id, { ...payment });
      for (const w of windows) grants.push({ ...w, id: id(), license: payment.license, payment: payment.charge_id, spent: 0 });
      return true;
    },
    async payment(chargeId) {
      const payment = payments.get(chargeId);
      return payment ? { ...payment } : null;
    },
    async refund(chargeId, at) {
      const payment = payments.get(chargeId);
      if (!payment || payment.refunded_at) return null;
      payment.refunded_at = at;
      for (let i = grants.length - 1; i >= 0; i--) if (grants[i].payment === chargeId) grants.splice(i, 1);
      return { ...payment };
    },
    async charge(grantId, usd) {
      const grant = grants.find((g) => g.id === grantId);
      if (grant) grant.spent += usd;
    },
  };
};
