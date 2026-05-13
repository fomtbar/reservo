'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type OpeningHour = {
  id: string;
  courtId: string | null;
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
};

type ScheduleException = {
  id: string;
  courtId: string | null;
  date: string;
  closedAllDay: boolean;
  opensAt: string | null;
  closesAt: string | null;
  reason: string | null;
};

type Block = {
  id: string;
  courtId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdBy: { id: string; name: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { label: 'Lunes',     value: 1 },
  { label: 'Martes',    value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves',    value: 4 },
  { label: 'Viernes',   value: 5 },
  { label: 'Sábado',    value: 6 },
  { label: 'Domingo',   value: 0 },
];

type DayState = { enabled: boolean; opensAt: string; closesAt: string };
type WeekState = Record<number, DayState>;

const DEFAULT_WEEK: WeekState = Object.fromEntries(
  DAYS.map(({ value }) => [value, { enabled: false, opensAt: '08:00', closesAt: '22:00' }]),
);

function hoursToWeek(hours: OpeningHour[]): WeekState {
  const state: WeekState = { ...DEFAULT_WEEK };
  for (const h of hours) {
    state[h.dayOfWeek] = { enabled: true, opensAt: h.opensAt, closesAt: h.closesAt };
  }
  return state;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Horarios Tab ─────────────────────────────────────────────────────────────

function HorariosTab({ courtId }: { courtId: string }) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const { data: rawHours = [] } = useQuery<OpeningHour[]>({
    queryKey: ['opening-hours', courtId],
    queryFn: () => apiFetch(`/opening-hours?courtId=${courtId}`, { token }),
    enabled: !!token,
  });

  const [week, setWeek] = useState<WeekState>(DEFAULT_WEEK);

  useEffect(() => {
    setWeek(hoursToWeek(rawHours));
  }, [rawHours]);

  const save = useMutation({
    mutationFn: () => {
      const hours = DAYS
        .filter(({ value }) => week[value].enabled)
        .map(({ value }) => ({
          dayOfWeek: value,
          opensAt: week[value].opensAt,
          closesAt: week[value].closesAt,
        }));
      return apiFetch('/opening-hours/bulk', { method: 'PUT', token, body: { courtId, hours } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opening-hours', courtId] });
      qc.invalidateQueries({ queryKey: ['opening-hours-public'] });
    },
  });

  const setDay = (dayValue: number, patch: Partial<DayState>) =>
    setWeek((w) => ({ ...w, [dayValue]: { ...w[dayValue], ...patch } }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Días y horarios en que esta cancha acepta reservas. Tildá los días habilitados.
      </p>

      <div className="space-y-2">
        {DAYS.map(({ label, value }) => (
          <div key={value} className="flex items-center gap-3 min-h-[36px]">
            <div className="w-28 flex items-center gap-2 shrink-0">
              <input
                type="checkbox"
                id={`day-${value}`}
                checked={week[value].enabled}
                onChange={(e) => setDay(value, { enabled: e.target.checked })}
                className="h-4 w-4 rounded border"
              />
              <label htmlFor={`day-${value}`} className="text-sm cursor-pointer select-none">
                {label}
              </label>
            </div>
            {week[value].enabled ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={week[value].opensAt}
                  onChange={(e) => setDay(value, { opensAt: e.target.value })}
                  className="w-28 h-8 text-sm"
                />
                <span className="text-muted-foreground text-xs">a</span>
                <Input
                  type="time"
                  value={week[value].closesAt}
                  onChange={(e) => setDay(value, { closesAt: e.target.value })}
                  className="w-28 h-8 text-sm"
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Cerrada</span>
            )}
          </div>
        ))}
      </div>

      {save.error && (
        <p className="text-xs text-destructive">{(save.error as Error).message}</p>
      )}
      {save.isSuccess && (
        <p className="text-xs text-green-600">✓ Horarios guardados</p>
      )}
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Guardando…' : 'Guardar horarios'}
      </Button>
    </div>
  );
}

// ─── Excepciones Tab ──────────────────────────────────────────────────────────

const EMPTY_EXC = { date: '', closedAllDay: true, opensAt: '', closesAt: '', reason: '' };

function ExcepcionesTab({ courtId }: { courtId: string }) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const { data: exceptions = [] } = useQuery<ScheduleException[]>({
    queryKey: ['exceptions', courtId],
    queryFn: () => apiFetch(`/schedule-exceptions?courtId=${courtId}`, { token }),
    enabled: !!token,
  });

  const [form, setForm] = useState(EMPTY_EXC);
  const set = (k: keyof typeof EMPTY_EXC) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/schedule-exceptions', {
        method: 'POST',
        token,
        body: {
          courtId,
          date: form.date,
          closedAllDay: form.closedAllDay,
          opensAt: (!form.closedAllDay && form.opensAt) ? form.opensAt : undefined,
          closesAt: (!form.closedAllDay && form.closesAt) ? form.closesAt : undefined,
          reason: form.reason || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exceptions', courtId] });
      setForm(EMPTY_EXC);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/schedule-exceptions/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exceptions', courtId] }),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Feriados, días especiales o mantenimiento. Sobreescriben el horario habitual para la fecha indicada.
      </p>

      {/* List */}
      {exceptions.length > 0 && (
        <div className="space-y-1">
          {exceptions.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">
                  {formatDate(ex.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {ex.closedAllDay ? (
                  <span className="text-muted-foreground ml-2">Cerrada todo el día</span>
                ) : (
                  <span className="text-muted-foreground ml-2">
                    {ex.opensAt} – {ex.closesAt}
                  </span>
                )}
                {ex.reason && (
                  <span className="text-muted-foreground ml-2 text-xs">· {ex.reason}</span>
                )}
              </div>
              <button
                onClick={() => remove.mutate(ex.id)}
                disabled={remove.isPending}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="rounded-md border p-3 space-y-3 bg-muted/20">
        <p className="text-xs font-medium">Agregar excepción</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Fecha *</Label>
            <Input type="date" value={form.date} onChange={set('date')} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo</Label>
            <Input placeholder="Ej: Feriado nacional" value={form.reason} onChange={set('reason')} className="h-8 text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="closedAllDay"
            checked={form.closedAllDay}
            onChange={(e) => setForm((f) => ({ ...f, closedAllDay: e.target.checked }))}
            className="h-4 w-4 rounded border"
          />
          <label htmlFor="closedAllDay" className="text-sm cursor-pointer">Cerrada todo el día</label>
        </div>

        {!form.closedAllDay && (
          <div className="flex items-center gap-2">
            <Input type="time" value={form.opensAt} onChange={set('opensAt')} className="w-28 h-8 text-sm" />
            <span className="text-muted-foreground text-xs">a</span>
            <Input type="time" value={form.closesAt} onChange={set('closesAt')} className="w-28 h-8 text-sm" />
          </div>
        )}

        {create.error && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={create.isPending || !form.date}
        >
          {create.isPending ? 'Guardando…' : 'Agregar'}
        </Button>
      </div>
    </div>
  );
}

// ─── Bloqueos Tab ─────────────────────────────────────────────────────────────

const EMPTY_BLOCK = { startsAt: '', endsAt: '', reason: '' };

function BloquesTab({ courtId }: { courtId: string }) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ['blocks', courtId],
    queryFn: () => apiFetch(`/blocks?courtId=${courtId}`, { token }),
    enabled: !!token,
  });

  const [form, setForm] = useState(EMPTY_BLOCK);
  const set = (k: keyof typeof EMPTY_BLOCK) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/blocks', {
        method: 'POST',
        token,
        body: {
          courtId,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          reason: form.reason || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocks', courtId] });
      setForm(EMPTY_BLOCK);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/blocks/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks', courtId] }),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Bloqueos puntuales de la cancha. Durante este período no se aceptan reservas.
      </p>

      {/* List */}
      {blocks.length > 0 ? (
        <div className="space-y-1">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">
                  {formatDate(b.startsAt, { weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
                <span className="text-muted-foreground mx-1">→</span>
                <span className="text-muted-foreground">
                  {formatDate(b.endsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
                {b.reason && (
                  <span className="text-muted-foreground ml-2 text-xs">· {b.reason}</span>
                )}
                {b.createdBy && (
                  <span className="text-muted-foreground ml-2 text-xs">por {b.createdBy.name}</span>
                )}
              </div>
              <button
                onClick={() => remove.mutate(b.id)}
                disabled={remove.isPending}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin bloqueos activos.</p>
      )}

      {/* Create form */}
      <div className="rounded-md border p-3 space-y-3 bg-muted/20">
        <p className="text-xs font-medium">Agregar bloqueo</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Inicio *</Label>
            <Input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fin *</Label>
            <Input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} className="h-8 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Motivo</Label>
          <Input placeholder="Ej: Mantenimiento de piso" value={form.reason} onChange={set('reason')} className="h-8 text-sm" />
        </div>
        {create.error && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}
        <Button
          size="sm"
          onClick={() => create.mutate()}
          disabled={create.isPending || !form.startsAt || !form.endsAt}
        >
          {create.isPending ? 'Guardando…' : 'Agregar bloqueo'}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

type Props = {
  courtId: string | null;
  courtName: string;
  onClose: () => void;
};

type Tab = 'horarios' | 'excepciones' | 'bloqueos';

export function CourtScheduleDialog({ courtId, courtName, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('horarios');

  return (
    <Dialog open={!!courtId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Horarios — {courtName}</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b -mx-6 px-6">
          <TabButton active={tab === 'horarios'} onClick={() => setTab('horarios')}>Horarios</TabButton>
          <TabButton active={tab === 'excepciones'} onClick={() => setTab('excepciones')}>Excepciones</TabButton>
          <TabButton active={tab === 'bloqueos'} onClick={() => setTab('bloqueos')}>Bloqueos</TabButton>
        </div>

        <div className="flex-1 overflow-y-auto pt-4">
          {courtId && tab === 'horarios' && <HorariosTab courtId={courtId} />}
          {courtId && tab === 'excepciones' && <ExcepcionesTab courtId={courtId} />}
          {courtId && tab === 'bloqueos' && <BloquesTab courtId={courtId} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
