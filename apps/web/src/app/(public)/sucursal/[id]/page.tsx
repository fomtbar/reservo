import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, ArrowLeft, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
};

type Court = {
  id: string;
  name: string;
  sport: string;
  color: string;
  defaultSlotMinutes: number;
  branchId: string | null;
};

type PublicSettings = { allowWebBooking: boolean; businessName: string };

async function getPageData(id: string) {
  const [branch, courts, settings] = await Promise.all([
    apiFetch<Branch>(`/branches/${id}`).catch(() => null),
    apiFetch<Court[]>(`/courts?branchId=${id}`).catch(() => [] as Court[]),
    apiFetch<PublicSettings>('/settings/public').catch(() => ({
      allowWebBooking: true,
      businessName: 'Reservo',
    })),
  ]);
  return { branch, courts, settings };
}

export default async function BranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branch, courts, settings } = await getPageData(id);

  if (!branch || !branch.active) notFound();

  const sports = [...new Set(courts.map((c) => c.sport))];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {settings.businessName}
      </Link>

      {/* Branch header */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{branch.name}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
            {branch.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {branch.address}
              </span>
            )}
            {branch.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 shrink-0" />
                {branch.phone}
              </span>
            )}
          </div>
        </div>

        {sports.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sports.map((sport) => (
              <Badge key={sport} variant="outline">{sport}</Badge>
            ))}
          </div>
        )}

        {settings.allowWebBooking && (
          <Button asChild>
            <Link href={`/reservar?branch=${branch.id}`}>
              <Calendar className="h-4 w-4 mr-2" />
              Reservar en esta sede
            </Link>
          </Button>
        )}
      </div>

      {/* Courts */}
      {courts.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {courts.length === 1 ? '1 cancha' : `${courts.length} canchas`}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courts.map((court) => (
              <div key={court.id} className="rounded-xl border bg-background p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: court.color }}
                  />
                  <span className="font-medium text-sm">{court.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{court.sport}</Badge>
                  <span className="text-xs text-muted-foreground">{court.defaultSlotMinutes} min</span>
                </div>
                {settings.allowWebBooking && (
                  <Link
                    href={`/reservar?branch=${branch.id}`}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Reservar →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta sede aún no tiene canchas configuradas.
        </p>
      )}
    </div>
  );
}
