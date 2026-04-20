/**
 * Warehouse inventory — Wave 15 UI gap closure.
 *
 *   GET    /api/v1/warehouse/items                    — list items
 *   POST   /api/v1/warehouse/items                    — create item
 *   GET    /api/v1/warehouse/items/:id/movements      — history
 *   POST   /api/v1/warehouse/items/:id/movements      — stock movement
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Boxes, Plus, Loader2, ArrowRightLeft } from 'lucide-react';
import { api } from '../lib/api';

interface Item {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly quantity: number;
  readonly condition: string;
  readonly warehouseLocation?: string;
  readonly unitOfMeasure?: string;
}

interface Movement {
  readonly id: string;
  readonly movementType: string;
  readonly quantityDelta: number;
  readonly reason?: string;
  readonly createdAt: string;
}

export default function WarehousePage(): JSX.Element {
  const [items, setItems] = useState<readonly Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<'create' | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [movements, setMovements] = useState<readonly Movement[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await api.get<readonly Item[]>('/warehouse/items');
    if (res.success && res.data) setItems(res.data);
    else setError(res.error ?? 'Unable to load items.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectItem = useCallback(async (item: Item) => {
    setSelected(item);
    const res = await api.get<readonly Movement[]>(
      `/warehouse/items/${encodeURIComponent(item.id)}/movements`,
    );
    if (res.success && res.data) setMovements(res.data);
    else setMovements([]);
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Warehouse inventory</h2>
            <p className="text-sm text-gray-500">Stock on hand across properties.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDrawer('create')}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
          No items in warehouse yet.
        </div>
      )}

      {!loading && items.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2">{i.category}</td>
                  <td className="px-3 py-2">{i.quantity}</td>
                  <td className="px-3 py-2">{i.condition}</td>
                  <td className="px-3 py-2">{i.warehouseLocation ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void selectItem(i)}
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <ArrowRightLeft className="h-3 w-3" /> History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {selected && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {selected.name} — stock movements
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-gray-500"
            >
              Close
            </button>
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-500 mt-3">No movements yet.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between py-1">
                  <span>
                    {m.movementType}{' '}
                    <span
                      className={m.quantityDelta < 0 ? 'text-red-600' : 'text-emerald-600'}
                    >
                      {m.quantityDelta > 0 ? '+' : ''}
                      {m.quantityDelta}
                    </span>
                    {m.reason && <span className="text-gray-500"> · {m.reason}</span>}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {drawer === 'create' && (
        <CreateItemDrawer
          onClose={() => setDrawer(null)}
          onCreated={() => {
            setDrawer(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

interface CreateFormState {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly quantity: string;
  readonly warehouseLocation: string;
}

const EMPTY_FORM: CreateFormState = {
  sku: '',
  name: '',
  category: '',
  quantity: '0',
  warehouseLocation: '',
};

function CreateItemDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}): JSX.Element {
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    const res = await api.post('/warehouse/items', {
      sku: form.sku,
      name: form.name,
      category: form.category,
      quantity: Number(form.quantity) || 0,
      warehouseLocation: form.warehouseLocation || undefined,
    });
    setSaving(false);
    if (res.success) {
      onCreated();
    } else {
      setError(res.error ?? 'Create failed.');
    }
  }

  return (
    <section className="bg-white border border-blue-200 rounded-xl p-5 space-y-3 max-w-lg">
      <h3 className="font-semibold text-gray-900">New warehouse item</h3>
      {(['sku', 'name', 'category', 'quantity', 'warehouseLocation'] as const).map(
        (field) => (
          <label key={field} className="block text-sm">
            <span className="text-gray-700">{field}</span>
            <input
              type={field === 'quantity' ? 'number' : 'text'}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ),
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-300 px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
