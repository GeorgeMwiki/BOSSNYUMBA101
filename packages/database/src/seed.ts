/**
 * BOSSNYUMBA Database Seed
 * Seeds demo tenant, admin user, sample properties, units, customers, and leases.
 * Admin: admin@bossnyumba.com / admin123
 */

import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { createDatabaseClient } from './client.js';
import {
  tenants,
  organizations,
  users,
  roles,
  userRoles,
  properties,
  units,
  customers,
  leases,
} from './schemas/index.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bossnyumba';

async function seed() {
  const db = createDatabaseClient(DATABASE_URL);
  const ADMIN_PASSWORD_HASH = await bcrypt.hash('admin123', 10);

  const tenantId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const adminUserId = crypto.randomUUID();
  const adminRoleId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();
  const unit1Id = crypto.randomUUID();
  const unit2Id = crypto.randomUUID();
  const customer1Id = crypto.randomUUID();
  const customer2Id = crypto.randomUUID();
  const lease1Id = crypto.randomUUID();
  const lease2Id = crypto.randomUUID();

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  try {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'BOSSNYUMBA Demo',
      slug: 'demo',
      status: 'active',
      subscriptionTier: 'professional',
      primaryEmail: 'demo@bossnyumba.com',
      primaryPhone: '+254700000000',
      addressLine1: 'Demo Estate, Westlands',
      city: 'Nairobi',
      country: 'KE',
      currentUsers: 1,
      currentProperties: 1,
      currentUnits: 2,
      maxUsers: 10,
      maxProperties: 50,
      maxUnits: 200,
    });

    await db.insert(organizations).values({
      id: orgId,
      tenantId,
      code: 'ROOT',
      name: 'Head Office',
      level: 0,
      path: '/',
    });

    await db.insert(users).values({
      id: adminUserId,
      tenantId,
      organizationId: orgId,
      email: 'admin@bossnyumba.com',
      firstName: 'Admin',
      lastName: 'User',
      displayName: 'Admin User',
      status: 'active',
      isOwner: true,
      passwordHash: ADMIN_PASSWORD_HASH,
    });

    await db.insert(roles).values({
      id: adminRoleId,
      tenantId,
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full access to all features',
      permissions: ['*'],
      isSystem: true,
    });

    await db.insert(userRoles).values({
      id: crypto.randomUUID(),
      userId: adminUserId,
      roleId: adminRoleId,
      tenantId,
    });

    await db.insert(properties).values({
      id: propertyId,
      tenantId,
      ownerId: adminUserId,
      propertyCode: 'DEMO-001',
      name: 'Sunrise Apartments',
      type: 'apartment_complex',
      status: 'active',
      addressLine1: 'Moi Avenue 100',
      city: 'Nairobi',
      country: 'KE',
      totalUnits: 2,
      occupiedUnits: 2,
      vacantUnits: 0,
    });

    await db.insert(units).values([
      {
        id: unit1Id,
        tenantId,
        propertyId,
        unitCode: '101',
        name: 'Unit 101',
        type: 'two_bedroom',
        status: 'occupied',
        baseRentAmount: 45000,
      },
      {
        id: unit2Id,
        tenantId,
        propertyId,
        unitCode: '102',
        name: 'Unit 102',
        type: 'three_bedroom',
        status: 'occupied',
        baseRentAmount: 55000,
      },
    ]);

    await db.insert(customers).values([
      {
        id: customer1Id,
        tenantId,
        customerCode: 'CUST-001',
        email: 'john.doe@example.com',
        phone: '+254712345678',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        kycStatus: 'verified',
      },
      {
        id: customer2Id,
        tenantId,
        customerCode: 'CUST-002',
        email: 'jane.smith@example.com',
        phone: '+254712345679',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
        kycStatus: 'verified',
      },
    ]);

    await db.insert(leases).values([
      {
        id: lease1Id,
        tenantId,
        propertyId,
        unitId: unit1Id,
        customerId: customer1Id,
        leaseNumber: 'LSE-001',
        leaseType: 'fixed_term',
        status: 'active',
        startDate: now,
        endDate: oneYearFromNow,
        rentAmount: 45000,
        rentFrequency: 'monthly',
        rentDueDay: 1,
        securityDepositAmount: 90000,
        securityDepositPaid: 90000,
        primaryOccupant: { name: 'John Doe', relationship: 'self', idNumber: '12345678' },
      },
      {
        id: lease2Id,
        tenantId,
        propertyId,
        unitId: unit2Id,
        customerId: customer2Id,
        leaseNumber: 'LSE-002',
        leaseType: 'fixed_term',
        status: 'active',
        startDate: now,
        endDate: oneYearFromNow,
        rentAmount: 55000,
        rentFrequency: 'monthly',
        rentDueDay: 1,
        securityDepositAmount: 110000,
        securityDepositPaid: 110000,
        primaryOccupant: { name: 'Jane Smith', relationship: 'self', idNumber: '87654321' },
      },
    ]);

    await db.update(units).set({
      currentLeaseId: lease1Id,
      currentCustomerId: customer1Id,
    }).where(eq(units.id, unit1Id));
    await db.update(units).set({
      currentLeaseId: lease2Id,
      currentCustomerId: customer2Id,
    }).where(eq(units.id, unit2Id));

    console.log('Seed completed successfully');
  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    process.exit(0);
  }
}

seed();
