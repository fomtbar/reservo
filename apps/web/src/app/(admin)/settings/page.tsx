'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url('URL inválida').or(z.literal('')).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido'),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  holdMinutes: z.coerce.number().min(1).max(120),
  allowWebBooking: z.boolean(),
  requireDepositForWeb: z.boolean(),
  cancellationPolicyHours: z.coerce.number().min(0),
  whatsappEnabled: z.boolean(),
  mpAccessToken: z.string().optional(),
});
type SettingsForm = z.infer<typeof schema>;

const TIMEZONES = [
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/Montevideo',
  'America/Sao_Paulo',
];

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const isOwner = session?.user.role === 'OWNER';
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<SettingsForm & { mpAccessTokenConfigured: boolean }>({
    queryKey: ['settings'],
    queryFn: () => apiFetch('/settings', { token }),
    enabled: !!token,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: '',
      primaryColor: '#3B82F6',
      timezone: 'America/Argentina/Buenos_Aires',
      currency: 'ARS',
      holdMinutes: 15,
      allowWebBooking: true,
      requireDepositForWeb: false,
      cancellationPolicyHours: 24,
      whatsappEnabled: false,
    },
  });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  // Live preview: update CSS variable when color changes
  const primaryColor = watch('primaryColor');
  useEffect(() => {
    if (primaryColor?.match(/^#[0-9a-fA-F]{6}$/)) {
      document.documentElement.style.setProperty('--color-primary', primaryColor);
    }
  }, [primaryColor]);

  const save = useMutation({
    mutationFn: (data: SettingsForm) =>
      apiFetch('/settings', { method: 'PATCH', body: data, token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  function BoolField({ name }: { name: 'allowWebBooking' | 'requireDepositForWeb' | 'whatsappEnabled' }) {
    const { field } = useController({ name, control });
    return <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={!isOwner} />;
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isOwner ? 'Ajustá los parámetros de tu negocio.' : 'Solo el Owner puede editar la configuración.'}
        </p>
      </div>

      <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
        {/* General */}
        <Section title="General" description="Identidad y apariencia del negocio.">
          <div className="space-y-1.5">
            <Label htmlFor="businessName">Nombre del negocio</Label>
            <Input id="businessName" disabled={!isOwner} {...register('businessName')} />
            {errors.businessName && <p className="text-xs text-destructive">{errors.businessName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logoUrl">URL del logo</Label>
            <Input id="logoUrl" placeholder="https://..." disabled={!isOwner} {...register('logoUrl')} />
            {errors.logoUrl && <p className="text-xs text-destructive">{errors.logoUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Color primario</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                disabled={!isOwner}
                {...register('primaryColor')}
                className="h-9 w-12 rounded-md border p-0.5 cursor-pointer disabled:cursor-not-allowed"
              />
              <Input
                className="w-28 font-mono text-xs"
                disabled={!isOwner}
                {...register('primaryColor')}
              />
              <span className="text-xs text-muted-foreground">Se actualiza en tiempo real</span>
            </div>
            {errors.primaryColor && <p className="text-xs text-destructive">{errors.primaryColor.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Zona horaria</Label>
            <select
              id="timezone"
              disabled={!isOwner}
              {...register('timezone')}
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" className="w-24" disabled={!isOwner} {...register('currency')} />
          </div>
        </Section>

        {/* Reservas */}
        <Section title="Reservas" description="Comportamiento del sistema de reservas.">
          <div className="space-y-1.5">
            <Label htmlFor="holdMinutes">Minutos de hold para reserva web</Label>
            <Input
              id="holdMinutes"
              type="number"
              min={1}
              max={120}
              className="w-24"
              disabled={!isOwner}
              {...register('holdMinutes')}
            />
            {errors.holdMinutes && <p className="text-xs text-destructive">{errors.holdMinutes.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cancel">Horas mínimas para cancelar</Label>
            <Input
              id="cancel"
              type="number"
              min={0}
              className="w-24"
              disabled={!isOwner}
              {...register('cancellationPolicyHours')}
            />
          </div>
          <FieldRow label="Reserva web pública" description="Permitir que clientes reserven desde la web.">
            <BoolField name="allowWebBooking" />
          </FieldRow>
          <FieldRow label="Requerir seña en web" description="Solicitar pago para confirmar reserva online.">
            <BoolField name="requireDepositForWeb" />
          </FieldRow>
        </Section>

        {/* Integraciones */}
        <Section title="Integraciones">
          <FieldRow label="WhatsApp habilitado" description="Enviar confirmaciones y recordatorios por WhatsApp.">
            <BoolField name="whatsappEnabled" />
          </FieldRow>
          <div className="space-y-1.5">
            <Label htmlFor="mpToken">Access token Mercado Pago</Label>
            {settings?.mpAccessTokenConfigured && (
              <p className="text-xs text-green-600">✓ Token configurado. Ingresá uno nuevo para reemplazarlo.</p>
            )}
            <Input
              id="mpToken"
              type="password"
              placeholder={settings?.mpAccessTokenConfigured ? '••••••••••••' : 'APP_USR-...'}
              disabled={!isOwner}
              {...register('mpAccessToken')}
            />
          </div>
        </Section>

        {isOwner && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!isDirty || save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            {save.isSuccess && <span className="text-sm text-green-600">✓ Guardado</span>}
            {save.error && <span className="text-sm text-destructive">{(save.error as Error).message}</span>}
          </div>
        )}
      </form>

      <LoyaltySection token={token} isOwner={isOwner} />
    </div>
  );
}

// ─── Loyalty Section ──────────────────────────────────────────────────────────

interface LoyaltyFormValues {
  enabled: boolean;
  silverMinBookings: number;
  goldMinBookings: number;
  silverDiscountPct: number;
  goldDiscountPct: number;
}

function LoyaltySection({ token, isOwner }: { token: string | undefined; isOwner: boolean }) {
  const qc = useQueryClient();
  const [values, setValues] = useState<LoyaltyFormValues>({
    enabled: false,
    silverMinBookings: 10,
    goldMinBookings: 25,
    silverDiscountPct: 5,
    goldDiscountPct: 10,
  });
  const [saved, setSaved] = useState(false);

  const { isLoading, data: loyaltyData } = useQuery<LoyaltyFormValues>({
    queryKey: ['loyalty-config'],
    queryFn: () => apiFetch('/loyalty/config', { token }),
    enabled: !!token,
  });

  useEffect(() => {
    if (loyaltyData) setValues(loyaltyData);
  }, [loyaltyData]);

  const save = useMutation({
    mutationFn: (dto: LoyaltyFormValues) =>
      apiFetch('/loyalty/config', { method: 'PATCH', body: dto, token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) return null;

  return (
    <Section title="Programa de fidelidad" description="Recompensá a los clientes frecuentes con descuentos automáticos.">
      <FieldRow label="Activar fidelidad">
        <Switch
          checked={values.enabled}
          onCheckedChange={(v) => setValues({ ...values, enabled: v })}
          disabled={!isOwner}
        />
      </FieldRow>

      {values.enabled && (
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <Label>Reservas para Silver</Label>
            <Input
              type="number" min={1}
              value={values.silverMinBookings}
              onChange={(e) => setValues({ ...values, silverMinBookings: +e.target.value })}
              disabled={!isOwner}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descuento Silver (%)</Label>
            <Input
              type="number" min={1} max={50}
              value={values.silverDiscountPct}
              onChange={(e) => setValues({ ...values, silverDiscountPct: +e.target.value })}
              disabled={!isOwner}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reservas para Gold</Label>
            <Input
              type="number" min={2}
              value={values.goldMinBookings}
              onChange={(e) => setValues({ ...values, goldMinBookings: +e.target.value })}
              disabled={!isOwner}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descuento Gold (%)</Label>
            <Input
              type="number" min={1} max={50}
              value={values.goldDiscountPct}
              onChange={(e) => setValues({ ...values, goldDiscountPct: +e.target.value })}
              disabled={!isOwner}
              className="w-24"
            />
          </div>
        </div>
      )}

      {isOwner && (
        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" onClick={() => save.mutate(values)} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar fidelidad'}
          </Button>
          {saved && <span className="text-sm text-green-600">✓ Guardado</span>}
        </div>
      )}
    </Section>
  );
}
