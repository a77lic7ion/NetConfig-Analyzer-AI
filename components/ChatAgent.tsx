import React from 'react';
import { ChatMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ChatAgentProps {
  chatHistory: ChatMessage[];
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
}

const ChatAgent: React.FC<ChatAgentProps> = ({ chatHistory, query, onQueryChange, onSubmit, isLoading, error }) => {
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to bottom on new message
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && query.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div className="flex flex-col h-[60vh] bg-light-background/50 rounded-lg border border-medium-background/50">
      <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl lg:max-w-2xl px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-sky-700 text-white' : 'bg-medium-background text-dark-text'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <h4 className="text-xs font-bold text-light-text mb-1">Sources:</h4>
                  <ul className="text-xs space-y-1">
                    {msg.sources.map((source, idx) => (
                      <li key={idx}>
                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                           {`[${idx + 1}] ${source.title || source.uri}`}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="max-w-xl lg:max-w-2xl px-4 py-2 rounded-lg bg-medium-background text-dark-text">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-brand-primary"></div>
                        <span className="text-sm text-medium-text">Thinking...</span>
                    </div>
                </div>
            </div>
        )}
      </div>
      <div className="p-4 border-t border-medium-background/50">
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLoading && query.trim()) {
              onSubmit();
            }
          }}
          className="flex items-center gap-2"
        >
          <textarea
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the analysis report..."
            rows={1}
            className="w-full bg-light-background border border-medium-background/80 text-dark-text rounded-lg p-2.5 focus:ring-brand-primary focus:border-brand-primary resize-none"
            aria-label="Chat input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-brand-primary text-white font-bold p-2.5 rounded-lg hover:bg-brand-secondary transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" transform="rotate(90 12 12)" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatAgent;
