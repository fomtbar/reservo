'use client';

import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  type: 'FIXED' | 'PERCENTAGE';
  value: string;
  minAmount: string | null;
  maxUses: number | null;
  usesCount: number;
  validFrom: string | null;
  validUntil: string | null;
  courtIds: string[];
  active: boolean;
  createdAt: string;
  _count: { applications: number };
}

interface PromoForm {
  code: string;
  description: string;
  type: 'FIXED' | 'PERCENTAGE';
  value: string;
  minAmount: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
}

const EMPTY_FORM: PromoForm = {
  code: '',
  description: '',
  type: 'FIXED',
  value: '',
  minAmount: '',
  maxUses: '',
  validFrom: '',
  validUntil: '',
};

function promoToForm(p: PromoCode): PromoForm {
  return {
    code: p.code,
    description: p.description ?? '',
    type: p.type,
    value: p.value,
    minAmount: p.minAmount ?? '',
    maxUses: p.maxUses != null ? String(p.maxUses) : '',
    validFrom: p.validFrom ? p.validFrom.slice(0, 10) : '',
    validUntil: p.validUntil ? p.validUntil.slice(0, 10) : '',
  };
}

function formToDto(f: PromoForm) {
  return {
    code: f.code,
    description: f.description || undefined,
    type: f.type,
    value: parseFloat(f.value),
    minAmount: f.minAmount ? parseFloat(f.minAmount) : undefined,
    maxUses: f.maxUses ? parseInt(f.maxUses, 10) : undefined,
    validFrom: f.validFrom || undefined,
    validUntil: f.validUntil || undefined,
  };
}

export default function PromosPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const { data: promos = [], isLoading } = useQuery<PromoCode[]>({
    queryKey: ['promos'],
    queryFn: () => apiFetch('/promo-codes', { token }),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (dto: ReturnType<typeof formToDto>) =>
      apiFetch('/promo-codes', { method: 'POST', body: dto, token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promos'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ReturnType<typeof formToDto> }) =>
      apiFetch(`/promo-codes/${id}`, { method: 'PATCH', body: dto, token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promos'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/promo-codes/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promos'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(p: PromoCode) {
    setEditing(p);
    setForm(promoToForm(p));
    setError('');
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.value || !form.code) { setError('Código y valor son obligatorios'); return; }
    const dto = formToDto(form);
    if (editing) updateMut.mutate({ id: editing.id, dto });
    else createMut.mutate(dto);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return formatDate(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const selectCls = 'flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Promociones</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo código
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Código</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Vigencia</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promos.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-10">
                    Sin códigos de promoción
                  </td>
                </tr>
              )}
              {promos.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{p.type === 'FIXED' ? 'Fijo' : '%'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {p.type === 'FIXED' ? `$${p.value}` : `${p.value}%`}
                  </td>
                  <td className="px-4 py-3">
                    {p.usesCount}{p.maxUses != null ? ` / ${p.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {p.validFrom || p.validUntil
                      ? `${fmtDate(p.validFrom)} – ${fmtDate(p.validUntil)}`
                      : 'Sin límite'}
                  </td>
                  <td className="px-4 py-3">
                    {p.active
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>
                      : <Badge variant="secondary">Inactivo</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMut.mutate(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar código' : 'Nuevo código de descuento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Código *</Label>
                <Input
                  placeholder="VERANO20"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Descripción</Label>
                <Input
                  placeholder="Descuento de verano"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PromoForm['type'] })}
                  className={selectCls}
                >
                  <option value="FIXED">Monto fijo ($)</option>
                  <option value="PERCENTAGE">Porcentaje (%)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={form.type === 'FIXED' ? '500' : '20'}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Monto mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Opcional"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Máx. usos</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Sin límite"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Válido desde</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Válido hasta</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
