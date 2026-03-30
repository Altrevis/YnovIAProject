'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant IA. Posez-moi une question ou analysez une URL pour commencer.',
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: '2',
      role: 'user',
      content: 'Peux-tu analyser le site example.com ?',
      timestamp: new Date(Date.now() - 240000),
    },
    {
      id: '3',
      role: 'assistant',
      content: 'Bien sûr ! Je vais analyser example.com pour toi. Cela va me prendre quelques secondes...',
      timestamp: new Date(Date.now() - 200000),
    },
    {
      id: '4',
      role: 'assistant',
      content: 'J\'ai trouvé 5 personnes et 3 entreprises associées à ce domaine. Voulez-vous les détails ?',
      timestamp: new Date(Date.now() - 150000),
    },
    {
      id: '5',
      role: 'user',
      content: 'Oui, montre-moi tous les résultats',
      timestamp: new Date(Date.now() - 100000),
    },
    {
      id: '6',
      role: 'assistant',
      content: 'Voici les résultats de l\'analyse. Vous pouvez voir les détails dans la zone "Résultats" en bas.',
      timestamp: new Date(),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Skip scroll on initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  return (
    <div className="bg-gradient-to-b from-gray-100 to-gray-50 rounded-2xl shadow-xl p-4 h-full flex flex-col border border-gray-200/50 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
          <MessageCircle size={20} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Conversation IA</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={48} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-sm">Aucun message pour le moment</p>
              <p className="text-gray-300 text-xs">Commencez une conversation !</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-lg px-4 py-2 rounded-2xl shadow-md transition-all duration-300 hover:shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border-2 border-gray-200'
                }`}
              >
                <p className="text-sm leading-relaxed font-medium">{message.content}</p>
                <span className={`text-xs mt-2 block ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString('fr-FR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Placeholder indicator */}
      {messages.length === 1 && (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 text-blue-700 text-xs text-center font-bold">
          💡 Tapez un message pour commencer à discuter
        </div>
      )}
    </div>
  );
}
