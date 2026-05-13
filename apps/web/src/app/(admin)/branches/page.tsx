'use client';

import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Building2, Pencil, Plus, PowerOff, Zap } from 'lucide-react';
import { useState } from 'react';

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  sortOrder: number;
  _count: { courts: number };
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
  sortOrder: string;
}

const EMPTY_FORM: BranchForm = { name: '', address: '', phone: '', sortOrder: '0' };

function branchToForm(b: Branch): BranchForm {
  return {
    name: b.name,
    address: b.address ?? '',
    phone: b.phone ?? '',
    sortOrder: String(b.sortOrder),
  };
}

function formToDto(f: BranchForm) {
  return {
    name: f.name,
    address: f.address || undefined,
    phone: f.phone || undefined,
    sortOrder: parseInt(f.sortOrder, 10) || 0,
  };
}

export default function BranchesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [error, setError] = useState('');

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => apiFetch('/branches?includeInactive=true', { token }),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (dto: ReturnType<typeof formToDto>) =>
      apiFetch('/branches', { method: 'POST', body: dto, token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ReturnType<typeof formToDto> }) =>
      apiFetch(`/branches/${id}`, { method: 'PATCH', body: dto, token }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); closeDialog(); },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (b: Branch) =>
      apiFetch(`/branches/${b.id}`, {
        method: 'PATCH',
        body: { active: !b.active },
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm(branchToForm(b));
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
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    const dto = formToDto(form);
    if (editing) updateMut.mutate({ id: editing.id, dto });
    else createMut.mutate(dto);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sucursales</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organizá tus canchas por sede o ubicación física.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nueva sucursal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border bg-background p-12 flex flex-col items-center gap-3 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sin sucursales. Creá la primera para organizar tus canchas por sede.
          </p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Crear sucursal
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Dirección</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Canchas</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {b.address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {b.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b._count.courts}</td>
                  <td className="px-4 py-3">
                    {b.active
                      ? <Badge className="bg-green-100 text-green-800 border-green-200">Activa</Badge>
                      : <Badge variant="secondary">Inactiva</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleMut.mutate(b)}
                      className={b.active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-600'}
                      title={b.active ? 'Desactivar' : 'Activar'}
                    >
                      {b.active ? <PowerOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
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
            <DialogTitle>{editing ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                placeholder="Sede Centro"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input
                placeholder="Av. Corrientes 1234, CABA"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  placeholder="+54 11 1234-5678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Orden</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
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
