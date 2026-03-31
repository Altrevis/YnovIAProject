'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function LegalPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-main)' }} className="min-h-screen pt-24">
      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-main)',
            borderColor: 'rgba(102, 71, 252, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
          }}
        >
          <ChevronLeft size={18} />
          Retour
        </Link>

        {/* Header */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'rgba(102, 71, 252, 0.2)',
        }} className="rounded-2xl shadow-xl border p-8 mb-8 transition-colors duration-200">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>
            Mentions légales
          </h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-lg">
            Informations légales et conditions d'utilisation
          </p>
        </div>

        {/* Content */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'rgba(102, 71, 252, 0.2)',
        }} className="rounded-2xl shadow-xl border p-8 space-y-8 transition-colors duration-200">

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Identification du site
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-2 text-sm">
              <p><strong>Nom du site :</strong> ChatBot IA - Analyse intelligente</p>
              <p><strong>URL :</strong> www.chatbot-ia.fr</p>
              <p><strong>Responsable :</strong> [À compléter]</p>
              <p><strong>Contact :</strong> contact@chatbot-ia.fr</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Conditions d'utilisation
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-3 text-sm leading-relaxed">
              <p>
                Ce site est fourni "tel quel" sans garantie d'aucune sorte. L'utilisation du site est à la discrétion de l'utilisateur.
                Nous nous réservons le droit de modifier le contenu et les services à tout moment.
              </p>
              <p>
                L'utilisateur s'engage à utiliser le site de manière légale et responsable, et à ne pas nuire à son fonctionnement.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Propriété intellectuelle
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-3 text-sm leading-relaxed">
              <p>
                Tous les contenus présents sur ce site (textes, images, logos, vidéos, etc.) sont la propriété exclusive de ChatBot IA
                ou sont utilisés avec autorisation.
              </p>
              <p>
                Toute reproduction, distribution, transmission, ou utilisation sans autorisation préalable est strictement interdite.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Données personnelles
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-3 text-sm leading-relaxed">
              <p>
                Conformément au RGPD, nous collectons et traitons vos données personnelles de manière sécurisée et responsable.
              </p>
              <p>
                Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données.
              </p>
              <p>
                Pour toute demande, contactez-nous à : privacy@chatbot-ia.fr
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Responsabilité
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-3 text-sm leading-relaxed">
              <p>
                ChatBot IA ne peut être tenu responsable des dommages directs ou indirects résultant de l'utilisation du site.
              </p>
              <p>
                Nous déclinons toute responsabilité concernant les contenus externes linkés depuis notre site.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>
              Cookies
            </h2>
            <div style={{ color: 'var(--text-secondary)' }} className="space-y-3 text-sm leading-relaxed">
              <p>
                Notre site utilise des cookies pour améliorer l'expérience utilisateur. Vous pouvez configurer votre navigateur
                pour refuser les cookies.
              </p>
            </div>
          </section>

          {/* Footer Note */}
          <div
            className="pt-6 border-t"
            style={{ borderColor: 'rgba(102, 71, 252, 0.2)' }}
          >
            <p style={{ color: 'var(--text-muted)' }} className="text-xs">
              Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
