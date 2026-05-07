import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-brand-600 font-bold text-lg">
          <TrendingUp size={20} /> CompetitorTrack
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-gray">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-gray-500 text-sm mb-8">Última actualización: mayo 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Información que recopilamos</h2>
          <p className="text-gray-600 leading-relaxed">
            Recopilamos la información que nos proporcionás al registrarte (nombre, email) y los datos que generás
            al usar el servicio (URLs de productos, precios, configuraciones de alertas). No vendemos ni
            compartimos tu información personal con terceros.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Uso de la información</h2>
          <p className="text-gray-600 leading-relaxed">
            Usamos tu información para operar el servicio, enviarte alertas de precios si las configurás, y
            mejorar la experiencia de la plataforma. Tu email puede usarse para comunicaciones relacionadas
            con tu cuenta.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Cookies</h2>
          <p className="text-gray-600 leading-relaxed">
            Usamos cookies técnicas necesarias para mantener tu sesión iniciada. No usamos cookies de
            seguimiento publicitario.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Seguridad</h2>
          <p className="text-gray-600 leading-relaxed">
            Tu contraseña se almacena cifrada con bcrypt. Usamos HTTPS en toda la plataforma. Los tokens de
            sesión tienen expiración automática.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Tus derechos</h2>
          <p className="text-gray-600 leading-relaxed">
            Podés solicitar la eliminación de tu cuenta y todos los datos asociados enviando un email a{' '}
            <a href="mailto:hola@competitortrack.com" className="text-brand-600 hover:underline">
              hola@competitortrack.com
            </a>
            . Procesamos las solicitudes en un plazo de 30 días.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contacto</h2>
          <p className="text-gray-600 leading-relaxed">
            Preguntas sobre esta política:{' '}
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
