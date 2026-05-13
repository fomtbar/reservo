'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type PromoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'valid'; description: string | null; code: string }
  | { status: 'invalid'; reason: string };

type Props = {
  slot: { courtId: string; courtName: string; start: Date; end: Date };
  onCancel: () => void;
  onSuccess: () => void;
  onSubmit: (data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    promoCode?: string;
  }) => void;
  isLoading: boolean;
  error: Error | null;
};

export function ReservationForm({
  slot,
  onCancel,
  onSuccess,
  onSubmit,
  isLoading,
  error,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoState>({ status: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePromoChange = (value: string) => {
    setPromoInput(value);
    setPromo({ status: 'idle' });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setPromo({ status: 'loading' });
      try {
        const result = await apiFetch<{ valid: boolean; description?: string; code: string; reason?: string }>(
          `/promo-codes/validate?code=${encodeURIComponent(value.trim())}&amount=1&courtId=${slot.courtId}`,
        );
        if (result.valid) {
          setPromo({ status: 'valid', description: result.description ?? null, code: result.code });
        } else {
          setPromo({ status: 'invalid', reason: result.reason ?? 'Código inválido' });
        }
      } catch {
        setPromo({ status: 'invalid', reason: 'No se pudo verificar el código' });
      }
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    onSubmit({
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      promoCode: promo.status === 'valid' ? promo.code : undefined,
    });
  };

  const slotTime = formatDate(slot.start.toISOString(), {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg max-w-md w-full p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Confirmar reserva</h2>
          <p className="text-sm text-muted-foreground">
            {slot.courtName} — {slotTime}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              placeholder="Tu nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono *</Label>
            <Input
              id="phone"
              placeholder="Ej: 1134567890"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input
              id="email"
              placeholder="tu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="promo">Código de descuento (opcional)</Label>
            <div className="relative">
              <Input
                id="promo"
                placeholder="VERANO20"
                value={promoInput}
                onChange={(e) => handlePromoChange(e.target.value.toUpperCase())}
                disabled={isLoading}
                className={
                  promo.status === 'valid'
                    ? 'border-green-500 pr-8'
                    : promo.status === 'invalid'
                      ? 'border-destructive pr-8'
                      : 'pr-8'
                }
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2">
                {promo.status === 'loading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {promo.status === 'valid' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {promo.status === 'invalid' && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>
            {promo.status === 'valid' && (
              <p className="text-xs text-green-700">
                Código válido{promo.description ? ` — ${promo.description}` : ''}
              </p>
            )}
            {promo.status === 'invalid' && (
              <p className="text-xs text-destructive">{promo.reason}</p>
            )}
          </div>

          {error && (
            <p className="text-xs text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !phone.trim()}
              className="flex-1"
            >
              {isLoading ? 'Reservando…' : 'Reservar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
