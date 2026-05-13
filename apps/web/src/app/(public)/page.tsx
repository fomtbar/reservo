import Link from 'next/link';
import type { Route } from 'next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Clock, Calendar, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type PublicSettings = {
  businessName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  allowWebBooking: boolean;
  currency: string;
};

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  _count: { courts: number };
};

type Court = {
  id: string;
  name: string;
  sport: string;
  color: string;
  defaultSlotMinutes: number;
  branchId: string | null;
  branch: { id: string; name: string } | null;
};

async function getPublicData() {
  const [settings, branches, courts] = await Promise.all([
    apiFetch<PublicSettings>('/settings/public').catch(() => ({
      businessName: 'Reservo',
      logoUrl: null,
      primaryColor: null,
      allowWebBooking: true,
      currency: 'ARS',
    })),
    apiFetch<Branch[]>('/branches').catch(() => [] as Branch[]),
    apiFetch<Court[]>('/courts').catch(() => [] as Court[]),
  ]);
  return { settings, branches, courts };
}

export default async function HomePage() {
  const { settings, branches, courts } = await getPublicData();

  const sports = [...new Set(courts.map((c) => c.sport))];
  const hasBranches = branches.length > 0;

  // Group courts by branch
  const courtsByBranch: Record<string, Court[]> = {};
  const unassigned: Court[] = [];
  for (const court of courts) {
    if (court.branchId) {
      (courtsByBranch[court.branchId] ??= []).push(court);
    } else {
      unassigned.push(court);
    }
  }

  return (
    <div className="space-y-0">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center text-center gap-6">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={settings.businessName}
              className="h-16 w-auto object-contain"
            />
          )}
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              {settings.businessName}
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Reservá tu turno online en segundos. Elegí la cancha, el día y el horario que más te convenga.
            </p>
          </div>

          {sports.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {sports.map((sport) => (
                <Badge key={sport} variant="outline" className="text-sm px-3 py-1">
                  {sport}
                </Badge>
              ))}
            </div>
          )}

          {settings.allowWebBooking && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/reservar">
                  <Calendar className="h-4 w-4 mr-2" />
                  Reservar ahora
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── Sucursales ───────────────────────────────────────────────── */}
      {hasBranches && (
        <section className="max-w-4xl mx-auto px-4 py-14 space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Nuestras sedes</h2>
            <p className="text-muted-foreground text-sm">Elegí la sede más cercana y reservá directamente.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <Link
                key={branch.id}
                href={`/sucursal/${branch.id}`}
                className="group rounded-xl border bg-background p-5 hover:border-primary/40 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                    {branch.name}
                  </h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {branch.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{branch._count.courts} {branch._count.courts === 1 ? 'cancha' : 'canchas'}</span>
                  </div>
                </div>
                {settings.allowWebBooking && (
                  <div className="pt-1">
                    <span className="text-xs font-medium text-primary">
                      Reservar en esta sede →
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Canchas ──────────────────────────────────────────────────── */}
      {courts.length > 0 && (
        <section className={`max-w-4xl mx-auto px-4 py-14 space-y-6 ${hasBranches ? 'border-t' : ''}`}>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">
              {hasBranches ? 'Todas las canchas' : 'Nuestras canchas'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {courts.length} {courts.length === 1 ? 'cancha disponible' : 'canchas disponibles'}
              {hasBranches && ' en todas las sedes'}
            </p>
          </div>

          {/* Courts grouped by branch */}
          {hasBranches && branches.map((branch) => {
            const branchCourts = courtsByBranch[branch.id] ?? [];
            if (branchCourts.length === 0) return null;
            return (
              <div key={branch.id} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {branch.name}
                </h3>
                <CourtGrid courts={branchCourts} branchId={branch.id} allowBooking={settings.allowWebBooking} />
              </div>
            );
          })}

          {/* Unassigned courts */}
          {unassigned.length > 0 && (
            <div className="space-y-3">
              {hasBranches && (
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sin sede asignada
                </h3>
              )}
              <CourtGrid courts={unassigned} allowBooking={settings.allowWebBooking} />
            </div>
          )}

          {/* No branches: flat list */}
          {!hasBranches && (
            <CourtGrid courts={courts} allowBooking={settings.allowWebBooking} />
          )}
        </section>
      )}

      {/* ── CTA final ────────────────────────────────────────────────── */}
      {settings.allowWebBooking && (
        <section className="border-t bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 py-14 flex flex-col items-center text-center gap-4">
            <h2 className="text-2xl font-bold">¿Listo para jugar?</h2>
            <p className="text-muted-foreground">
              Seleccioná la fecha, la cancha y confirmá tu reserva en menos de un minuto.
            </p>
            <Button asChild size="lg">
              <Link href="/reservar">Ver disponibilidad →</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Court grid component ──────────────────────────────────────────────────────

function CourtGrid({
  courts,
  branchId,
  allowBooking,
}: {
  courts: Court[];
  branchId?: string;
  allowBooking: boolean;
}) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {courts.map((court) => {
        const href = allowBooking
          ? `/reservar${branchId ? `?branch=${branchId}` : ''}`
          : '#';
        return (
          <div
            key={court.id}
            className="rounded-xl border bg-background p-4 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-3.5 w-3.5 rounded-full shrink-0"
                style={{ backgroundColor: court.color }}
              />
              <span className="font-medium text-sm">{court.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">{court.sport}</Badge>
              <span>{court.defaultSlotMinutes} min</span>
            </div>
            {allowBooking && (
              <Link
                href={href as Route}
                className="text-xs text-primary font-medium hover:underline mt-auto"
              >
                Reservar →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
