import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ExitoPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-6">
      <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">¡Pago exitoso!</h1>
        <p className="text-muted-foreground">
          Tu reserva fue confirmada. Recibirás los detalles a la brevedad.
        </p>
      </div>
      <Link
        href="/reservar"
        className="inline-block text-sm text-primary underline underline-offset-4"
      >
        Hacer otra reserva
      </Link>
    </div>
  );
}
