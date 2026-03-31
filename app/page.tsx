'use client';

import { useState } from 'react';
import Navbar from '@/components/navbar';
import FilterPanel from '@/components/filter-panel';
import ChatArea from '@/components/chat-area';
import InputArea from '@/components/input-area';
import ResultsTable from '@/components/results-table';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Exhibitor {
  id: string;
  nom: string;
  description: string;
  siteWeb: string;
  logo: string;
  stand: string;
  pays: string;
  linkedin: string;
  twitter: string;
  categories: string;
  email: string;
  telephone: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [url, setUrl] = useState('');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['all']);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

  const legalText = `MENTIONS LEGALES
Exhibition Scraper Agent

1. Editeur et responsable de la publication
En vertu de l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'economie numerique, il est precise aux utilisateurs du site https://www.exhibition-scraper.com que :
Entreprise : SHAARP SAS
Siege social : France (adresse administrative communiquee sur demande)
SIRET : non communique dans ce projet
Capital social : non communique dans ce projet
Telephone : non communique dans ce projet
Email : contact@shaarp.com

2. Directeur de la publication
Nom : non communique dans ce projet
Fonction : Responsable de la publication

3. Hebergement
Fournisseur d'hebergement : Amazon Web Services (AWS)
Localisation : Region Europe (eu-west-1, Irlande)
Adresse : AWS EMEA SARL, 38 Avenue John F. Kennedy, 75116 Paris, France
Site : www.aws.amazon.com

4. Propriete intellectuelle
L'ensemble du contenu de ce site (textes, images, code source, logos, design, structure) est la propriete exclusive de SHAARP ou de ses partenaires et est protege par les lois sur le droit d'auteur.
Toute reproduction, modification, distribution ou utilisation du contenu sans autorisation ecrite est interdite.
Les donnees extraites par l'application (noms, emails, sites web des exposants) restent la propriete de leurs sources originales. SHAARP n'en est que l'intermediaire d'extraction.

5. Conditions d'utilisation
En accedant a Exhibition Scraper Agent, l'utilisateur accepte l'integralite de ces mentions legales.
L'application est destinee a l'extraction legale de donnees d'exposants a des fins commerciales legitimes. Sont interdits : le scraping massif non autorise, le spam, le harcelement, la revente de donnees et toute utilisation contraire a la loi.
L'utilisateur est responsable de l'utilisation de l'application et des donnees extraites, notamment du respect des conditions d'utilisation des sites sources.

6. Limitation de responsabilite
SHAARP ne peut etre tenue responsable de :
- Les erreurs ou omissions dans les donnees extraites
- Les interruptions ou indisponibilite du service
- Les dommages directs ou indirects resultant de l'utilisation
- L'acces aux sites sources bloque ou modifie
- Les consequences legales de l'utilisation des donnees

7. Protection des donnees personnelles
Conformement au Reglement General sur la Protection des Donnees (RGPD) et a la loi Informatique et Libertes, SHAARP s'engage a proteger les donnees personnelles des utilisateurs.
SHAARP collecte : adresse email, donnees de connexion, historique d'utilisation, donnees de facturation.
L'utilisateur dispose d'un droit d'acces, de rectification, de suppression, d'opposition et de portabilite de ses donnees. Pour exercer ces droits, veuillez contacter : privacy@shaarp.com
Pour toute reclamation relative a la protection des donnees, l'utilisateur peut saisir la CNIL : https://www.cnil.fr

8. Securite
SHAARP implemente les mesures de securite suivantes :
- Chiffrement TLS/HTTPS de toutes les communications
- Authentification securisee (JWT/OAuth2)
- Controle d'acces base sur les roles
- Logs de securite et monitoring continu
- Respect des normes ISO/IEC 27001

9. Signalement de vulnerabilites
Pour signaler une faille de securite, veuillez contacter : security@shaarp.com. Les signalements seront traites de maniere confidentielle et prioritaire.

10. Modification des services
SHAARP se reserve le droit de modifier ou d'interrompre les services a tout moment, avec ou sans preavis en cas d'urgence de securite.
Les modifications importantes seront notifiees aux utilisateurs par email.

11. Droit applicable
Ces mentions legales sont regies par la loi francaise. Tout litige sera soumis a la juridiction des tribunaux francais competents.
SHAARP peut modifier ces mentions legales a tout moment. Les modifications entrent en vigueur a la publication. L'utilisation continue implique l'acceptation des nouvelles conditions.

12. Contact
Email general : contact@shaarp.com
Service client : support@shaarp.com
Securite : security@shaarp.com
Protection des donnees : privacy@shaarp.com

© 2024 SHAARP. Tous droits reserves.`;

  const handleAnalyzeUrl = async () => {
    if (!url.trim()) return;

    setScrapeLoading(true);
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `Analyser: ${url}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: `❌ Erreur: ${data.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else if (data.exhibitors && Array.isArray(data.exhibitors)) {
        setExhibitors(data.exhibitors);
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-success`,
          role: 'assistant',
          content: `✅ Trouvé ${data.count} exposants sur ${url}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-catch`,
        role: 'assistant',
        content: `❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setScrapeLoading(false);
    }
  };

  // Regex pour extraire les URLs
  const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\]]+/gi;

  const extractUrls = (text: string): string[] => {
    const matches = text.match(URL_REGEX) || [];
    return matches;
  };

  const shouldFillTable = (userMessage: string): boolean => {
    const lowerMsg = userMessage.toLowerCase();
    return (
      /remplissez|fill|tableau|table|affich|show|résultats|results|exposants|exhibitors|données|data/i.test(lowerMsg) &&
      /tableau|table|résultats|results|exposants|exhibitors|données|data/i.test(lowerMsg)
    ) || extractUrls(userMessage).length > 0;
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || chatLoading) return;

    setChatLoading(true);
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Vérifier si on doit remplir le tableau
    const fillTable = shouldFillTable(message);
    const urls = extractUrls(message);

    // Si une URL est mentionnée, la scraper pour remplir le tableau
    if (fillTable && urls.length > 0) {
      try {
        console.log('📥 Auto-scraping for table fill:', urls[0]);
        const fillResponse = await fetch('/api/fill-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[0] }),
        });

        if (fillResponse.ok) {
          const fillData = await fillResponse.json();
          if (fillData.exhibitors && Array.isArray(fillData.exhibitors)) {
            console.log(`✅ Displaying ${fillData.exhibitors.length} exhibitors in table`);
            setExhibitors(fillData.exhibitors);
          }
        }
      } catch (err) {
        console.error('❌ Auto-scrape failed:', err);
      }
    }

    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line || line === ':') continue;

          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6);
              const data = JSON.parse(jsonStr);

              let textDelta = '';
              if (data.type === 'text-delta' && data.delta) {
                textDelta = data.delta;
              } else if (data.choices?.[0]?.delta?.content) {
                textDelta = data.choices[0].delta.content;
              }

              if (textDelta) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.id === assistantMessage.id) {
                    lastMsg.content += textDelta;
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Parse error - skip
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.id === assistantMessage.id) {
          lastMsg.content = `❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: 'var(--bg-main)' }}
      className="relative isolate flex flex-col w-screen min-h-screen font-sans overflow-x-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f7f7fc,#ffffff)] opacity-100 transition-opacity duration-500 dark:opacity-0" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0b0b0f,#12121a)] opacity-0 transition-opacity duration-500 dark:opacity-100" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar onOpenLegal={() => setIsLegalModalOpen(true)} />

        <main className="flex flex-1 gap-4 px-6 pt-24 pb-6 overflow-visible w-screen">
          <aside className="w-[298px] flex-shrink-0 max-h-[660px] flex flex-col">
            <FilterPanel
              url={url}
              onUrlChange={setUrl}
              selectedEntities={selectedEntities}
              onEntitiesChange={setSelectedEntities}
              onAnalyze={handleAnalyzeUrl}
              isLoading={scrapeLoading}
            />
          </aside>

          <div className="flex-1 flex flex-col gap-3 overflow-visible">
            <div className="flex-shrink-0 h-[550px]">
              <ChatArea messages={messages} />
            </div>
            <div className="flex-shrink-0 h-[100px]">
              <InputArea onSend={handleSendMessage} isLoading={chatLoading} />
            </div>
          </div>
        </main>

        <div className="flex-1 px-6 pb-6 overflow-visible w-screen">
          <ResultsTable exhibitors={exhibitors} />
        </div>
      </div>

      {isLegalModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onClick={() => setIsLegalModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'rgba(102, 71, 252, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'rgba(102, 71, 252, 0.2)' }}
            >
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                Mentions legales
              </h2>
              <button
                onClick={() => setIsLegalModalOpen(false)}
                className="px-3 py-1 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: 'rgba(102, 71, 252, 0.12)',
                  color: 'var(--text-main)',
                }}
              >
                Fermer
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-72px)]">
              <pre
                className="whitespace-pre-wrap text-sm leading-relaxed"
                style={{
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {legalText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

