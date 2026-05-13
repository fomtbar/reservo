import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CanceladoPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-6">
      <XCircle className="h-16 w-16 mx-auto text-destructive" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Pago cancelado</h1>
        <p className="text-muted-foreground">
          No se procesó ningún cobro. Tu pre-reserva seguirá activa por unos minutos
          para que puedas intentarlo de nuevo.
        </p>
      </div>
      <Link
        href="/reservar"
        className="inline-block text-sm text-primary underline underline-offset-4"
      >
        Volver a intentar
      </Link>
    </div>
  );
}
