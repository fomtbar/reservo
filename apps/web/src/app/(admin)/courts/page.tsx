'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Plus, PowerOff, Zap } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { CourtScheduleDialog } from '@/components/courts/court-schedule-dialog';
import { apiFetch } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Branch = { id: string; name: string };

type Court = {
  id: string;
  name: string;
  sport: string;
  color: string;
  active: boolean;
  sortOrder: number;
  defaultSlotMinutes: number;
  bufferMinutes: number;
  branchId: string | null;
  branch: Branch | null;
};

const SPORTS = ['Pádel', 'Tenis', 'Fútbol 5', 'Fútbol 7', 'Hockey', 'Básquet', 'Vóley', 'Squash', 'Otro'];
const SLOT_OPTIONS = [30, 45, 60, 90, 120];

const courtSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  sport: z.string().min(1, 'Requerido'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido'),
  defaultSlotMinutes: z.coerce.number().min(15),
  bufferMinutes: z.coerce.number().min(0),
  sortOrder: z.coerce.number().min(0),
  branchId: z.string().optional(),
});
type CourtForm = z.infer<typeof courtSchema>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CourtsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Court | null>(null);
  const [scheduleCourt, setScheduleCourt] = useState<{ id: string; name: string } | null>(null);

  const { data: courts = [], isLoading } = useQuery<Court[]>({
    queryKey: ['courts'],
    queryFn: () => apiFetch('/courts?includeInactive=true', { token }),
    enabled: !!token,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => apiFetch('/branches', { token }),
    enabled: !!token,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CourtForm>({
    resolver: zodResolver(courtSchema),
    defaultValues: { color: '#3B82F6', defaultSlotMinutes: 60, bufferMinutes: 0, sortOrder: 0 },
  });

  const save = useMutation({
    mutationFn: (data: CourtForm) => {
      const body = { ...data, branchId: data.branchId || undefined };
      return editing
        ? apiFetch(`/courts/${editing.id}`, { method: 'PATCH', body, token })
        : apiFetch('/courts', { method: 'POST', body, token });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['courts'] }); closeDialog(); },
  });

  const toggle = useMutation({
    mutationFn: (court: Court) =>
      court.active
        ? apiFetch(`/courts/${court.id}`, { method: 'DELETE', token })
        : apiFetch(`/courts/${court.id}`, { method: 'PATCH', body: { active: true }, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courts'] }),
  });

  function openCreate() {
    setEditing(null);
    reset({ color: '#3B82F6', defaultSlotMinutes: 60, bufferMinutes: 0, sortOrder: 0, name: '', sport: '', branchId: '' });
    setOpen(true);
  }

  function openEdit(court: Court) {
    setEditing(court);
    reset({
      name: court.name,
      sport: court.sport,
      color: court.color,
      defaultSlotMinutes: court.defaultSlotMinutes,
      bufferMinutes: court.bufferMinutes,
      sortOrder: court.sortOrder,
      branchId: court.branchId ?? '',
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Canchas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Administrá las canchas disponibles</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nueva cancha
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-background overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : courts.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No hay canchas. Creá la primera.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cancha</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deporte</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Sucursal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Slot</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Buffer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: court.color }}
                      />
                      <span className="font-medium">{court.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{court.sport}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {court.branch?.name ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{court.defaultSlotMinutes} min</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{court.bufferMinutes} min</td>
                  <td className="px-4 py-3">
                    <Badge variant={court.active ? 'success' : 'secondary'}>
                      {court.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setScheduleCourt({ id: court.id, name: court.name })}
                        title="Horarios y bloqueos"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(court)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggle.mutate(court)}
                        title={court.active ? 'Desactivar' : 'Activar'}
                        className={court.active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                      >
                        {court.active ? <PowerOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule dialog */}
      <CourtScheduleDialog
        courtId={scheduleCourt?.id ?? null}
        courtName={scheduleCourt?.name ?? ''}
        onClose={() => setScheduleCourt(null)}
      />

      {/* Dialog create / edit */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cancha' : 'Nueva cancha'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" placeholder="Cancha 1" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sport">Deporte</Label>
                <select
                  id="sport"
                  {...register('sport')}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="">Seleccionar…</option>
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.sport && <p className="text-xs text-destructive">{errors.sport.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input id="color" type="color" className="w-12 p-0.5 cursor-pointer" {...register('color')} />
                  <Input placeholder="#3B82F6" {...register('color')} className="flex-1 font-mono text-xs" />
                </div>
              </div>

              {branches.length > 0 && (
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="branchId">Sucursal</Label>
                  <select
                    id="branchId"
                    {...register('branchId')}
                    className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <option value="">Sin sucursal</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="slot">Duración slot</Label>
                <select
                  id="slot"
                  {...register('defaultSlotMinutes')}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {SLOT_OPTIONS.map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="buffer">Buffer entre turnos</Label>
                <Input id="buffer" type="number" min={0} step={5} {...register('bufferMinutes')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sort">Orden</Label>
                <Input id="sort" type="number" min={0} {...register('sortOrder')} />
              </div>
            </div>

            {save.error && (
              <p className="text-xs text-destructive">{(save.error as Error).message}</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || save.isPending}>
                {save.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cancha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
