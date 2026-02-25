/**
 * Repository Factory
 *
 * In development: uses InMemory repositories (no database needed).
 * In production:  uses Prisma-backed repositories (requires DATABASE_URL).
 *
 * When Prisma implementations are ready, update createRepositories()
 * to return them when DATABASE_URL is present.
 */

import { InMemoryPaymentIntentRepository } from './payment-intent.repository';
import { InMemoryAccountRepository } from './account.repository';
import { InMemoryLedgerRepository } from './ledger.repository';
import { InMemoryStatementRepository } from './statement.repository';
import { InMemoryDisbursementRepository } from './disbursement.repository';
import type { IPaymentIntentRepository } from './payment-intent.repository';
import type { IAccountRepository } from './account.repository';
import type { ILedgerRepository } from './ledger.repository';
import type { IStatementRepository } from './statement.repository';
import type { IDisbursementRepository } from './disbursement.repository';

export interface Repositories {
  paymentIntentRepository: IPaymentIntentRepository;
  accountRepository: IAccountRepository;
  ledgerRepository: ILedgerRepository;
  statementRepository: IStatementRepository;
  disbursementRepository: IDisbursementRepository;
}

export function createRepositories(logger?: { warn: (obj: object, msg: string) => void }): Repositories {
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (hasDatabaseUrl) {
    // Prisma implementations will be wired here once migrations are run.
    // For now, still use InMemory but warn loudly in production.
    if (isProduction) {
      logger?.warn(
        { reason: 'prisma_repos_not_yet_implemented' },
        'DATABASE_URL is set but Prisma repositories are not yet wired. Using InMemory (data will be lost on restart).'
      );
    }
  } else if (isProduction) {
    logger?.warn(
      { reason: 'no_database_url' },
      'DATABASE_URL is not set in production. Using InMemory repositories (data will be lost on restart).'
    );
  }

  return {
    paymentIntentRepository: new InMemoryPaymentIntentRepository(),
    accountRepository: new InMemoryAccountRepository(),
    ledgerRepository: new InMemoryLedgerRepository(),
    statementRepository: new InMemoryStatementRepository(),
    disbursementRepository: new InMemoryDisbursementRepository(),
  };
}
