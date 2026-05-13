'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { QrCode, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';
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
import { formatCurrency, formatDate } from '@/lib/utils';

export type PaymentRecord = {
  id: string;
  amount: string;
  method: string;
  createdAt: string;
};

export type BookingEvent = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  price: string;
  paidAmount: string;
  paymentStatus: string;
  notes: string | null;
  court: { id: string; name: string };
  customer: { id: string; name: string; phone: string } | null;
  createdBy: { id: string; name: string } | null;
  payments: PaymentRecord[];
};

const STATUS_LABEL: Record<string, string> = {
  HELD: 'En espera',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No presentado',
};

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'secondary' | 'destructive' | 'default'> = {
  HELD: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'secondary',
  COMPLETED: 'default',
  NO_SHOW: 'destructive',
};

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  MERCADOPAGO: 'MercadoPago',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Sin cobrar',
  PARTIAL: 'Seña',
  PAID: 'Pagado',
  REFUNDED: 'Devuelto',
};

export function BookingDetail({
  booking,
  onClose,
}: {
  booking: BookingEvent | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');

  // Always fetch fresh data so payments are up-to-date after mutations
  const { data: fresh } = useQuery<BookingEvent>({
    queryKey: ['booking', booking?.id],
    queryFn: () => apiFetch(`/bookings/${booking!.id}`, { token }),
    enabled: !!booking?.id && !!token,
  });
  const b = fresh ?? booking;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['booking', booking?.id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  const action = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: string; body?: object }) =>
      apiFetch(endpoint, { method: 'POST', token, body }),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const addPayment = useMutation({
    mutationFn: () =>
      apiFetch(`/bookings/${booking!.id}/payments`, {
        method: 'POST',
        token,
        body: { amount: parseFloat(payAmount), method: payMethod },
      }),
    onSuccess: () => {
      invalidate();
      setPayAmount('');
      setPayMethod('CASH');
      setShowPay(false);
    },
  });

  const deletePayment = useMutation({
    mutationFn: (payId: string) =>
      apiFetch(`/payments/${payId}`, { method: 'DELETE', token }),
    onSuccess: () => invalidate(),
  });

  if (!b) return null;

  const { status } = b;
  const canConfirm = status === 'HELD';
  const canCancel = status === 'HELD' || status === 'CONFIRMED';
  const canComplete = status === 'CONFIRMED';
  const canNoShow = status === 'CONFIRMED';
  const canPay = status !== 'CANCELLED';

  const fmt = (iso: string) =>
    formatDate(iso, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  const paid = parseFloat(b.paidAmount ?? '0');
  const price = parseFloat(b.price ?? '0');
  const remaining = Math.max(0, price - paid);

  return (
    <Dialog open={!!booking} onOpenChange={(v) => { if (!v) { setShowCancel(false); setShowPay(false); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reserva
            <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{STATUS_LABEL[status] ?? status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Cancha">{b.court.name}</Row>
          <Row label="Inicio">{fmt(b.startsAt)}</Row>
          <Row label="Fin">{fmt(b.endsAt)}</Row>
          <Row label="Cliente">
            {b.customer
              ? `${b.customer.name} · ${b.customer.phone}`
              : <span className="text-muted-foreground">Sin cliente</span>}
          </Row>
          <Row label="Precio">{formatCurrency(b.price)}</Row>
          <Row label="Pagado">
            <span className={paid >= price && price > 0 ? 'text-green-600 font-semibold' : ''}>
              {formatCurrency(b.paidAmount)}
            </span>
            {remaining > 0 && (
              <span className="text-muted-foreground ml-1 font-normal">
                (resta {formatCurrency(String(remaining))})
              </span>
            )}
            <Badge variant="outline" className="ml-2 text-[10px] py-0">
              {PAYMENT_STATUS_LABEL[b.paymentStatus] ?? b.paymentStatus}
            </Badge>
          </Row>
          {b.notes && <Row label="Notas">{b.notes}</Row>}
          {b.createdBy && <Row label="Creado por">{b.createdBy.name}</Row>}
        </div>

        {/* Payment history */}
        {b.payments && b.payments.length > 0 && (
          <div className="mt-3 border rounded-md divide-y text-sm">
            {b.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                  <span className="text-muted-foreground ml-2">{METHOD_LABEL[p.method] ?? p.method}</span>
                </div>
                <button
                  onClick={() => deletePayment.mutate(p.id)}
                  disabled={deletePayment.isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Inline payment form */}
        {showPay && (
          <div className="mt-3 border rounded-md p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Registrar cobro</p>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Monto</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Método</Label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="flex h-8 rounded-md border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="MERCADOPAGO">MercadoPago</option>
                </select>
              </div>
            </div>
            {addPayment.error && (
              <p className="text-xs text-destructive">{(addPayment.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => addPayment.mutate()}
                disabled={addPayment.isPending || !payAmount || parseFloat(payAmount) <= 0}
              >
                {addPayment.isPending ? 'Guardando…' : 'Confirmar cobro'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPay(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* QR panel */}
        {showQr && (
          <div className="mt-3 flex flex-col items-center gap-3 border rounded-md p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Código QR de la reserva</p>
            <div className="bg-white p-3 rounded-md">
              <QRCode
                value={`${window.location.origin}/reserva/${b.id}`}
                size={160}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Escanear para verificar la reserva en el mostrador
            </p>
          </div>
        )}

        {/* Cancel reason form */}
        {showCancel && (
          <div className="mt-3 space-y-2">
            <Label>Motivo de cancelación (opcional)</Label>
            <Input
              placeholder="Ej: el cliente no se pudo presentar"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        )}

        {action.error && (
          <p className="text-xs text-destructive mt-2">{(action.error as Error).message}</p>
        )}

        <DialogFooter className="flex-wrap gap-2 mt-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cerrar</Button>
          </DialogClose>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowQr((v) => !v)}
            title="Ver QR"
          >
            <QrCode className="h-4 w-4" />
          </Button>

          {canPay && !showPay && (
            <Button size="sm" variant="secondary" onClick={() => setShowPay(true)}>
              Registrar cobro
            </Button>
          )}

          {canConfirm && (
            <Button
              size="sm"
              onClick={() => action.mutate({ endpoint: `/bookings/${b.id}/confirm` })}
              disabled={action.isPending}
            >
              Confirmar
            </Button>
          )}

          {canComplete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => action.mutate({ endpoint: `/bookings/${b.id}/complete` })}
              disabled={action.isPending}
            >
              Completar
            </Button>
          )}

          {canNoShow && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => action.mutate({ endpoint: `/bookings/${b.id}/no-show` })}
              disabled={action.isPending}
            >
              No-show
            </Button>
          )}

          {canCancel && !showCancel && (
            <Button size="sm" variant="destructive" onClick={() => setShowCancel(true)}>
              Cancelar reserva
            </Button>
          )}

          {canCancel && showCancel && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                action.mutate({
                  endpoint: `/bookings/${b.id}/cancel`,
                  body: { reason: cancelReason || undefined },
                })
              }
              disabled={action.isPending}
            >
              Confirmar cancelación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
