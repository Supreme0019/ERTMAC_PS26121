import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Bot, User, Sparkles, Loader, Copy, RefreshCw, XCircle } from 'lucide-react';
import { assistantAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import './AssistantPage.css';

const SUGGESTIONS = [
  'What mud loss events occurred around 2700–2900 m?',
  'What was the reservoir pressure gradient in ZZZ-999?',
  'What were the main problems encountered while drilling in Formation X and Kopili?',
  'What historical mitigations were applied for stuck pipe incidents in offset wells?',
  'Compare offset wells near WELL-A-102 within 15km radius',
];

function generateUUID() {
  return crypto.randomUUID();
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const wellId = searchParams.get('wellId');
  const [sessionId, setSessionId] = useState(generateUUID());
  
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Welcome to the **eRTMAC-NWIS AI Assistant** — your intelligent drilling knowledge companion.\n\nI can help you with:\n- 🔍 Querying historical offset well data\n- ⚠️ Analyzing drilling risks and events\n- 📊 Comparing wells and formations\n- 📄 Searching through indexed documents\n- 💡 Generating drilling recommendations\n\nAsk me anything about your drilling operations!`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(text = input) {
    if (!text.trim() || loading) return;
    
    const userMessage = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const payload = {
        question: text.trim(),
        session_id: sessionId,
        context: {
          include_nearby: true,
          include_parameters: true,
        }
      };
      
      if (wellId) {
        payload.well_id = wellId;
      }
      
      const { data } = await assistantAPI.query(payload);
      const resData = data.data;

      const ctxSum = resData?.context_summary;
      const contextStr = ctxSum && typeof ctxSum === 'object'
        ? `Well: ${ctxSum.well_found ? 'Found' : 'N/A'} | Events: ${ctxSum.events_count || 0} | Nearby: ${ctxSum.nearby_wells_count || 0} | Docs: ${ctxSum.document_chunks_count || 0} | Formations: ${ctxSum.formations_count || 0}`
        : ctxSum;

      const assistantMsg = {
        role: 'assistant',
        content: resData?.answer || resData?.response || 'I processed your query. Here are the relevant insights from our drilling database.',
        evidence: resData?.sources || resData?.evidence,
        contextSummary: contextStr,
        followUps: resData?.follow_up_questions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'AI service unavailable. Please try again later.',
        error: true,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
  }
  
  async function clearChat() {
    try {
      await assistantAPI.clearHistory(sessionId);
    } catch (err) {
      console.error('Failed to clear history on backend:', err);
    }
    setSessionId(generateUUID());
    setMessages([messages[0]]);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="assistant-page">
      <div className="assistant-container">
        {/* Header */}
        <div className="assistant-header glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="assistant-avatar">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>NWIS AI Assistant</h2>
              {wellId ? (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-accent-cyan)' }}>Context Well: {wellId}</p>
              ) : (
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>RAG-powered drilling intelligence</p>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={clearChat} id="btn-clear-chat">
            <RefreshCw size={14} /> Clear
          </button>
        </div>

        {/* Chat Messages */}
        <div className="assistant-messages">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`chat-message chat-message-${msg.role} ${msg.error ? 'chat-message-error' : ''}`}
              >
                <div className={`chat-avatar ${msg.role === 'assistant' ? 'chat-avatar-bot' : 'chat-avatar-user'}`}>
                  {msg.role === 'assistant' ? (msg.error ? <XCircle size={16} /> : <Bot size={16} />) : <User size={16} />}
                </div>
                <div className="chat-bubble">
                  <div className="chat-content" dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br/>')
                      .replace(/- (.*?)(?=<br|$)/g, '• $1')
                  }} />
                  
                  {msg.contextSummary && (
                    <div className="chat-context-summary" style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      Context: {msg.contextSummary}
                    </div>
                  )}

                  {msg.evidence && msg.evidence.length > 0 && (
                    <div className="chat-evidence" style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      <div className="chat-evidence-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📋 Cited Historical Evidence & Documents ({msg.evidence.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {msg.evidence.map((ev, j) => {
                          const wellDisp = ev.well_name || ev.well || (ev.well_id ? `Well ${ev.well_id.slice(0, 8)}` : 'Offset Well');
                          const isEvent = ev.type === 'event' || ev.event_type;
                          const depthText = ev.depth ? `${ev.depth} m` : null;
                          const formText = ev.formation || null;
                          const docName = ev.doc || ev.document_id || ev.source || ev.title;
                          const pageNum = ev.page || 1;
                          const quoteText = ev.quote || ev.description || ev.text;
                          const mitigationText = ev.mitigation;

                          return (
                            <div key={j} className="chat-evidence-item" style={{
                              background: 'rgba(15, 23, 42, 0.45)',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              fontSize: '0.8rem'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ background: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    {ev.id || `S${j + 1}`}
                                  </span>
                                  <strong style={{ color: '#38bdf8' }}>{wellDisp}</strong>
                                  {depthText && <span style={{ color: 'var(--color-text-secondary)' }}>• {depthText}</span>}
                                  {formText && <span style={{ color: '#a78bfa' }}>({formText})</span>}
                                </div>
                                {ev.severity && (
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: ev.severity.toUpperCase() === 'CRITICAL' ? '#ef4444' : ev.severity.toUpperCase() === 'HIGH' ? '#f59e0b' : '#3b82f6',
                                    color: '#fff'
                                  }}>
                                    {ev.severity.toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {quoteText && (
                                <div style={{ fontStyle: 'italic', color: 'var(--color-text-primary)', marginTop: '2px', lineHeight: 1.4, borderLeft: '2px solid #38bdf8', paddingLeft: '8px' }}>
                                  "{quoteText}"
                                </div>
                              )}

                              {mitigationText && (
                                <div style={{ fontSize: '0.74rem', color: '#34d399', marginTop: '2px' }}>
                                  <strong>Mitigation:</strong> {mitigationText}
                                </div>
                              )}

                              {docName && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>📄 Source: <strong>{docName}</strong></span>
                                  {pageNum && <span>Page: <strong>{pageNum}</strong></span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="chat-followups" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {msg.followUps.map((fu, j) => (
                        <button key={j} className="btn btn-ghost btn-sm" onClick={() => handleSend(fu)} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                          {fu}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="chat-meta">
                    <span>{msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.role === 'assistant' && !msg.error && (
                      <button className="chat-copy" onClick={() => copyToClipboard(msg.content)} title="Copy">
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-avatar chat-avatar-bot"><Bot size={16} /></div>
              <div className="chat-bubble chat-typing">
                <Loader size={16} className="chat-typing-icon" />
                <span>Analyzing drilling data...</span>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="assistant-suggestions">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => handleSend(s)}>
                <Sparkles size={12} /> {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="assistant-input glass">
          <textarea
            className="input assistant-textarea"
            placeholder="Ask about drilling operations, offset wells, or formation data..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            id="assistant-input"
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            id="btn-send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
