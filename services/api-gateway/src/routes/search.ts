// @ts-nocheck
/**
 * Cross-entity search API
 *
 * Simple case-insensitive contains-search across properties, units, and
 * customers using the existing @bossnyumba/database repositories.
 * Results are scoped to the caller's tenant and property access list and
 * mapped to the shape the client expects:
 *   { properties: [...], units: [...], tenants: [...] }
 *
 * If the database is not configured, the databaseMiddleware already
 * returns 503.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { mapCustomerRow, mapPropertyRow, mapUnitRow } from './db-mappers';

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

function hasPropertyAccess(auth: any, propertyId?: string | null): boolean {
  if (!propertyId) return false;
  return auth.propertyAccess?.includes('*') || auth.propertyAccess?.includes(propertyId);
}

function containsInsensitive(haystack: unknown, needle: string): boolean {
  return String(haystack ?? '').toLowerCase().includes(needle);
}

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const rawQ = (c.req.query('q') ?? c.req.query('query') ?? '').trim();
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);

  if (!rawQ) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Query parameter "q" is required' },
      },
      400
    );
  }

  const q = rawQ.toLowerCase();

  const [propertiesResult, unitsResult, customersResult] = await Promise.all([
    repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
    repos.units.findMany(auth.tenantId, { limit: 2000, offset: 0 }),
    repos.customers.findMany(auth.tenantId, { limit: 2000, offset: 0 }),
  ]);

  const accessibleProperties = propertiesResult.items.filter((p: any) =>
    hasPropertyAccess(auth, p.id)
  );
  const accessiblePropertyIds = new Set(accessibleProperties.map((p: any) => p.id));

  const matchedProperties = accessibleProperties
    .filter((row: any) =>
      [row.name, row.propertyCode, row.addressLine1, row.city, row.description].some((v) =>
        containsInsensitive(v, q)
      )
    )
    .slice(0, limit)
    .map((row: any) => {
      const mapped = mapPropertyRow(row);
      return {
        id: mapped.id,
        name: mapped.name,
        propertyCode: mapped.propertyCode,
        city: mapped.address?.city,
        type: mapped.type,
        status: mapped.status,
      };
    });

  const matchedUnits = unitsResult.items
    .filter((row: any) => accessiblePropertyIds.has(row.propertyId))
    .filter((row: any) =>
      [row.unitCode, row.unitNumber, row.name, row.floor, row.description].some((v) =>
        containsInsensitive(v, q)
      )
    )
    .slice(0, limit)
    .map((row: any) => {
      const mapped = mapUnitRow(row);
      return {
        id: mapped.id,
        unitNumber: mapped.unitNumber,
        propertyId: mapped.propertyId,
        status: mapped.status,
        rentAmount: mapped.rentAmount,
      };
    });

  const matchedCustomers = customersResult.items
    .filter((row: any) =>
      [row.firstName, row.lastName, row.email, row.phone, row.customerCode].some((v) =>
        containsInsensitive(v, q)
      )
    )
    .slice(0, limit)
    .map((row: any) => {
      const mapped = mapCustomerRow(row);
      return {
        id: mapped.id,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        email: mapped.email,
        phone: mapped.phone,
      };
    });

  return c.json({
    success: true,
    data: {
      properties: matchedProperties,
      units: matchedUnits,
      tenants: matchedCustomers,
    },
    query: rawQ,
  });
});

export const searchRouter = app;
