'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';

const schema = z.object({
  customerName: z.string().min(1, 'Requerido'),
  customerPhone: z.string().min(6, 'Mínimo 6 dígitos'),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  source: z.enum(['WALK_IN', 'PHONE', 'WEB']),
  notes: z.string().optional(),
});
type Form = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  initialStart: string; // ISO datetime string
  initialEnd: string;
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string) {
  return new Date(local).toISOString();
}

type LoyaltyTier = 'NONE' | 'SILVER' | 'GOLD';
interface LoyaltyInfo { tier: LoyaltyTier; discountPct: number; totalBookings: number }

const TIER_LABEL: Record<LoyaltyTier, string> = {
  NONE: '',
  SILVER: '🥈 Silver',
  GOLD: '🥇 Gold',
};

export function BookingForm({ open, onClose, courtId, courtName, initialStart, initialEnd }: Props) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      startsAt: toDatetimeLocal(initialStart),
      endsAt: toDatetimeLocal(initialEnd),
      source: 'WALK_IN',
    },
  });

  const phoneValue = watch('customerPhone');
  useEffect(() => {
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    setLoyalty(null);
    if (!phoneValue || phoneValue.length < 6) return;
    phoneDebounce.current = setTimeout(async () => {
      try {
        const bookings = await apiFetch<Array<{ id: string }>>(`/bookings/by-phone?phone=${encodeURIComponent(phoneValue)}`, { token });
        if (bookings.length === 0) return;
        // Get loyalty from customers list (we don't have customer id yet — use bookings endpoint loyalty data indirectly)
        // Instead call loyalty endpoint via customer search
        const page = await apiFetch<{ data: Array<{ id: string; loyalty: LoyaltyInfo }> }>(`/customers?q=${encodeURIComponent(phoneValue)}&limit=1`, { token });
        const customer = page.data[0];
        if (customer?.loyalty?.tier && customer.loyalty.tier !== 'NONE') {
          setLoyalty(customer.loyalty);
        }
      } catch { /* ignore */ }
    }, 700);
  }, [phoneValue, token]);

  const save = useMutation({
    mutationFn: (data: Form) =>
      apiFetch('/bookings', {
        method: 'POST',
        token,
        body: {
          courtId,
          startsAt: fromDatetimeLocal(data.startsAt),
          endsAt: fromDatetimeLocal(data.endsAt),
          source: data.source,
          notes: data.notes || undefined,
          customer: { name: data.customerName, phone: data.customerPhone },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva reserva — {courtName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inicio</Label>
              <Input type="datetime-local" {...register('startsAt')} />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input type="datetime-local" {...register('endsAt')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nombre del cliente</Label>
            <Input placeholder="Juan Pérez" {...register('customerName')} />
            {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input placeholder="1134567890" {...register('customerPhone')} />
            {errors.customerPhone && <p className="text-xs text-destructive">{errors.customerPhone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Origen</Label>
            <select
              {...register('source')}
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="WALK_IN">Presencial</option>
              <option value="PHONE">Teléfono</option>
              <option value="WEB">Web</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea placeholder="Ej: trae sus propias raquetas" rows={2} {...register('notes')} />
          </div>

          {loyalty && loyalty.tier !== 'NONE' && (
            <div className={`rounded-md border px-3 py-2 text-sm ${loyalty.tier === 'GOLD' ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
              Cliente frecuente {TIER_LABEL[loyalty.tier]} — {loyalty.totalBookings} reservas.
              {loyalty.discountPct > 0 && ` Tiene ${loyalty.discountPct}% de descuento disponible.`}
            </div>
          )}

          {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Crear reserva'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
