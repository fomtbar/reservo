'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

type Court = { id: string; name: string };

type PricingRule = {
  id: string;
  label: string;
  amount: string;
  courtId: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  validFrom: string | null;
  validUntil: string | null;
  priority: number;
  active: boolean;
  court?: { name: string } | null;
};

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function ruleDescription(r: PricingRule): string {
  const parts: string[] = [];
  if (r.dayOfWeek !== null) parts.push(DAYS[r.dayOfWeek]);
  if (r.startTime && r.endTime) parts.push(`${r.startTime}–${r.endTime}`);
  if (r.court) parts.push(r.court.name);
  else if (!r.courtId) parts.push('Todas las canchas');
  if (r.validFrom || r.validUntil) {
    parts.push(`${r.validFrom ?? ''}–${r.validUntil ?? ''}`);
  }
  return parts.join(' · ') || 'Global';
}

type FormState = {
  label: string;
  amount: string;
  courtId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string;
  priority: string;
  active: boolean;
};

const EMPTY: FormState = {
  label: '',
  amount: '',
  courtId: '',
  dayOfWeek: '',
  startTime: '',
  endTime: '',
  validFrom: '',
  validUntil: '',
  priority: '0',
  active: true,
};

function ruleToForm(r: PricingRule): FormState {
  return {
    label: r.label,
    amount: r.amount,
    courtId: r.courtId ?? '',
    dayOfWeek: r.dayOfWeek !== null ? String(r.dayOfWeek) : '',
    startTime: r.startTime ?? '',
    endTime: r.endTime ?? '',
    validFrom: r.validFrom ? r.validFrom.slice(0, 10) : '',
    validUntil: r.validUntil ? r.validUntil.slice(0, 10) : '',
    priority: String(r.priority),
    active: r.active,
  };
}

function formToDto(f: FormState) {
  return {
    label: f.label,
    amount: parseFloat(f.amount),
    courtId: f.courtId || undefined,
    dayOfWeek: f.dayOfWeek !== '' ? parseInt(f.dayOfWeek) : undefined,
    startTime: f.startTime || undefined,
    endTime: f.endTime || undefined,
    validFrom: f.validFrom || undefined,
    validUntil: f.validUntil || undefined,
    priority: parseInt(f.priority) || 0,
    active: f.active,
  };
}

export default function PricingPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: rules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ['pricing-rules'],
    queryFn: () => apiFetch('/pricing-rules', { token }),
    enabled: !!token,
  });

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['courts'],
    queryFn: () => apiFetch('/courts', { token }),
    enabled: !!token,
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r: PricingRule) => { setEditing(r); setForm(ruleToForm(r)); setOpen(true); };

  const save = useMutation({
    mutationFn: (data: ReturnType<typeof formToDto>) =>
      editing
        ? apiFetch(`/pricing-rules/${editing.id}`, { method: 'PATCH', token, body: data })
        : apiFetch('/pricing-rules', { method: 'POST', token, body: data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing-rules'] }); setOpen(false); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/pricing-rules/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] }),
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Precios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reglas de precio por cancha, día y horario.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva regla
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border bg-background py-16 text-center text-sm text-muted-foreground">
          No hay reglas de precio. Creá una para empezar.
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Aplica a</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Precio</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Prioridad</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{ruleDescription(r)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{r.priority}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={r.active ? 'success' : 'secondary'}>
                      {r.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={() => remove.mutate(r.id)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regla' : 'Nueva regla de precio'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Label + amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input placeholder="Ej: Fin de semana noche" value={form.label} onChange={set('label')} />
              </div>
              <div className="space-y-1.5">
                <Label>Precio *</Label>
                <Input type="number" min="0" step="0.01" placeholder="5000" value={form.amount} onChange={set('amount')} />
              </div>
            </div>

            {/* Court */}
            <div className="space-y-1.5">
              <Label>Cancha <span className="text-muted-foreground text-xs">(vacío = todas)</span></Label>
              <select
                value={form.courtId}
                onChange={set('courtId')}
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">Todas las canchas</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Day + times */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Día <span className="text-muted-foreground text-xs">(vacío = todos)</span></Label>
                <select
                  value={form.dayOfWeek}
                  onChange={set('dayOfWeek')}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="">Todos los días</option>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Hora inicio</Label>
                <Input type="time" value={form.startTime} onChange={set('startTime')} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora fin</Label>
                <Input type="time" value={form.endTime} onChange={set('endTime')} />
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vigencia desde</Label>
                <Input type="date" value={form.validFrom} onChange={set('validFrom')} />
              </div>
              <div className="space-y-1.5">
                <Label>Vigencia hasta</Label>
                <Input type="date" value={form.validUntil} onChange={set('validUntil')} />
              </div>
            </div>

            {/* Priority + active */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad <span className="text-muted-foreground text-xs">(mayor número gana)</span></Label>
                <Input type="number" min="0" value={form.priority} onChange={set('priority')} className="w-24" />
              </div>
              <div className="space-y-1.5 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="h-4 w-4 rounded border"
                  />
                  <span className="text-sm">Regla activa</span>
                </label>
              </div>
            </div>
          </div>

          {save.error && (
            <p className="text-xs text-destructive">{(save.error as Error).message}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => save.mutate(formToDto(form))}
              disabled={save.isPending || !form.label || !form.amount}
            >
              {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear regla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
