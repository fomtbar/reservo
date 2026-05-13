'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SlotInfo = { courtId: string; courtName: string; start: Date; end: Date };

type Props = {
  slot: SlotInfo;
  onCancel: () => void;
  onSubmit: (data: { name: string; phone: string; email?: string }) => void;
  isLoading: boolean;
  error: Error | null;
};

export function WaitlistForm({ slot, onCancel, onSubmit, isLoading, error }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const timeLabel = `${slot.start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${slot.end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const dateLabel = slot.start.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, phone, email: email || undefined });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-background rounded-xl border shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">Lista de espera</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {slot.courtName} · {dateLabel} · {timeLabel}
            </p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Te avisamos cuando este turno se libere.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="wl-name">Nombre *</Label>
            <Input
              id="wl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wl-phone">Teléfono *</Label>
            <Input
              id="wl-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 1234-5678"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wl-email">Email (opcional)</Label>
            <Input
              id="wl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Guardando…' : 'Anotarme'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
