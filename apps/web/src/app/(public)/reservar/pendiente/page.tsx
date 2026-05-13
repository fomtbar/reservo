import { Clock } from 'lucide-react';
import Link from 'next/link';

export default function PendientePage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-6">
      <Clock className="h-16 w-16 mx-auto text-yellow-500" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Pago pendiente</h1>
        <p className="text-muted-foreground">
          Tu pago está siendo procesado. Una vez acreditado te confirmaremos la reserva.
          Si tenés dudas, comunicate con el local.
        </p>
      </div>
      <Link
        href="/reservar"
        className="inline-block text-sm text-primary underline underline-offset-4"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
