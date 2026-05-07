import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-brand-600 font-bold text-lg">
          <TrendingUp size={20} /> CompetitorTrack
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Términos de Servicio</h1>
        <p className="text-gray-500 text-sm mb-8">Última actualización: mayo 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceptación</h2>
          <p className="text-gray-600 leading-relaxed">
            Al usar CompetitorTrack aceptás estos términos. Si no estás de acuerdo, no uses el servicio.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Descripción del servicio</h2>
          <p className="text-gray-600 leading-relaxed">
            CompetitorTrack es una plataforma de monitoreo de precios para vendedores de e-commerce.
            Permite rastrear precios de productos propios y de competidores en marketplaces como MercadoLibre
            y Amazon, y recibir alertas ante cambios de precios.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Uso aceptable</h2>
          <p className="text-gray-600 leading-relaxed mb-3">No está permitido:</p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Usar el servicio para actividades ilegales</li>
            <li>Intentar sobrecargar o atacar la infraestructura</li>
            <li>Revender o redistribuir el servicio sin autorización</li>
            <li>Usar automatizaciones para crear cuentas masivamente</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Planes y pagos</h2>
          <p className="text-gray-600 leading-relaxed">
            Los planes de pago se facturan mensualmente. Podés cancelar en cualquier momento desde
            Configuración → Suscripción. No realizamos reembolsos por períodos parciales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Disponibilidad</h2>
          <p className="text-gray-600 leading-relaxed">
            Apuntamos a una disponibilidad del 99 % pero no garantizamos servicio ininterrumpido.
            La exactitud de los precios depende de la disponibilidad de los sitios externos monitoreados.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Limitación de responsabilidad</h2>
          <p className="text-gray-600 leading-relaxed">
            CompetitorTrack no es responsable por decisiones comerciales tomadas en base a los datos
            de la plataforma. Los precios mostrados son referenciales y pueden tener demora.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contacto</h2>
          <p className="text-gray-600 leading-relaxed">
            Consultas:{' '}
            <a href="mailto:hola@competitortrack.com" className="text-brand-600 hover:underline">
              hola@competitortrack.com
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
        <Link href="/" className="hover:text-gray-600">← Volver al inicio</Link>
      </footer>
    </div>
  );
}
