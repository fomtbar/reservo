'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Search, UserCheck, X } from 'lucide-react';
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

type CustomerSuggestion = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  totalBookings: number;
};

type LoyaltyTier = 'NONE' | 'SILVER' | 'GOLD';
interface LoyaltyInfo { tier: LoyaltyTier; discountPct: number; totalBookings: number }

const TIER_LABEL: Record<LoyaltyTier, string> = {
  NONE: '',
  SILVER: '🥈 Silver',
  GOLD: '🥇 Gold',
};

type Props = {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courtName: string;
  initialStart: string;
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

export function BookingForm({ open, onClose, courtId, courtName, initialStart, initialEnd }: Props) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  // Customer typeahead
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [picked, setPicked] = useState<CustomerSuggestion | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loyalty banner
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null);
  const loyaltyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      startsAt: toDatetimeLocal(initialStart),
      endsAt: toDatetimeLocal(initialEnd),
      source: 'WALK_IN',
    },
  });

  // Reset everything when dialog opens for a new slot
  useEffect(() => {
    if (open) {
      reset({
        startsAt: toDatetimeLocal(initialStart),
        endsAt: toDatetimeLocal(initialEnd),
        source: 'WALK_IN',
        customerName: '',
        customerPhone: '',
        notes: '',
      });
      setSearch('');
      setSuggestions([]);
      setShowDropdown(false);
      setPicked(null);
      setLoyalty(null);
    }
  }, [open, initialStart, initialEnd, reset]);

  // Search customers as user types
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!search.trim() || search.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: CustomerSuggestion[] }>(
          `/customers?q=${encodeURIComponent(search)}&limit=6`,
          { token },
        );
        setSuggestions(res.data);
        setShowDropdown(res.data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [search, token]);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Loyalty banner when phone is typed manually
  const phoneValue = watch('customerPhone');
  useEffect(() => {
    if (loyaltyDebounce.current) clearTimeout(loyaltyDebounce.current);
    setLoyalty(null);
    if (!phoneValue || phoneValue.length < 6) return;
    loyaltyDebounce.current = setTimeout(async () => {
      try {
        const page = await apiFetch<{ data: Array<{ loyalty: LoyaltyInfo }> }>(
          `/customers?q=${encodeURIComponent(phoneValue)}&limit=1`,
          { token },
        );
        const c = page.data[0];
        if (c?.loyalty?.tier && c.loyalty.tier !== 'NONE') setLoyalty(c.loyalty);
      } catch { /* ignore */ }
    }, 700);
  }, [phoneValue, token]);

  function selectCustomer(c: CustomerSuggestion) {
    setPicked(c);
    setValue('customerName', c.name, { shouldValidate: true });
    setValue('customerPhone', c.phone, { shouldValidate: true });
    setSearch('');
    setSuggestions([]);
    setShowDropdown(false);
  }

  function clearPicked() {
    setPicked(null);
    setValue('customerName', '');
    setValue('customerPhone', '');
    setLoyalty(null);
  }

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
          // If an existing customer was selected, pass their id directly.
          // Otherwise create/upsert by name+phone.
          ...(picked
            ? { customerId: picked.id }
            : { customer: { name: data.customerName, phone: data.customerPhone } }),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
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
          {/* Horario */}
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

          {/* Buscador de cliente */}
          <div className="space-y-3">
            <div className="relative" ref={searchRef}>
              <Label className="mb-1.5 block">Buscar cliente existente</Label>

              {picked ? (
                <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                  <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1 font-medium">{picked.name}</span>
                  <span className="text-muted-foreground">{picked.phone}</span>
                  <button
                    type="button"
                    onClick={clearPicked}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Nombre o teléfono…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
              )}

              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-[200] mt-1 w-full rounded-md border border-border bg-white shadow-lg overflow-hidden dark:bg-gray-900">
                  {suggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent text-left"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCustomer(c)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.phone}{c.email ? ` · ${c.email}` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {c.totalBookings} reservas
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nombre y teléfono — siempre visibles, pre-rellenados si se seleccionó */}
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input placeholder="Juan Pérez" {...register('customerName')} />
              {errors.customerName && (
                <p className="text-xs text-destructive">{errors.customerName.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input placeholder="1134567890" {...register('customerPhone')} />
              {errors.customerPhone && (
                <p className="text-xs text-destructive">{errors.customerPhone.message}</p>
              )}
            </div>
          </div>

          {/* Origen */}
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

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea placeholder="Ej: trae sus propias raquetas" rows={2} {...register('notes')} />
          </div>

          {/* Loyalty banner */}
          {loyalty && loyalty.tier !== 'NONE' && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                loyalty.tier === 'GOLD'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              Cliente frecuente {TIER_LABEL[loyalty.tier]} — {loyalty.totalBookings} reservas.
              {loyalty.discountPct > 0 && ` Tiene ${loyalty.discountPct}% de descuento disponible.`}
            </div>
          )}

          {/* Error de guardado */}
          {save.error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(save.error as Error).message}
            </div>
          )}

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
