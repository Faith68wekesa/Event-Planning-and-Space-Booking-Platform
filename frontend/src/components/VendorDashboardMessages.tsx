import React, { useState } from 'react';
import { Search, Send, MessageCircle } from 'lucide-react';

export interface ChatMessage {
  id: number;
  sender: 'CUSTOMER' | 'VENDOR';
  text: string;
  time: string;
}

export interface Conversation {
  id: number;
  customerName: string;
  service: string;
  messages: ChatMessage[];
  unread: number;
  avatar: string;
}

export const VendorDashboardMessages: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  
  // Initialized empty as requested (no mock data)
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const filteredConversations = conversations.filter(c => 
    c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.service.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeChat = conversations.find(c => c.id === activeConversation);

  const handleSelectConversation = (id: number) => {
    setActiveConversation(id);
    // Mark as read
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, unread: 0 } : c
    ));
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeConversation) return;

    const newMsg: ChatMessage = {
      id: Date.now(),
      sender: 'VENDOR',
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations(prev => prev.map(c => 
      c.id === activeConversation 
        ? { ...c, messages: [...c.messages, newMsg] }
        : c
    ));
    setNewMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', height: 'calc(100vh - 180px)', minHeight: '600px' }}>
      
      {/* Conversations List */}
      <div className="dashboard-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Messages
          </h3>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search messages..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}
            />
          </div>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {filteredConversations.map(conv => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            return (
              <div 
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                style={{ 
                  padding: '16px 20px', 
                  borderBottom: '1px solid #f1f5f9', 
                  cursor: 'pointer',
                  background: activeConversation === conv.id ? '#f8fafc' : '#fff',
                  display: 'flex',
                  gap: '12px',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d8a73', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  {conv.avatar}
                </div>
                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{conv.customerName}</span>
                    <span style={{ fontSize: '0.75rem', color: conv.unread > 0 ? '#0d8a73' : '#94a3b8', fontWeight: conv.unread > 0 ? 700 : 500 }}>
                      {lastMsg?.time || ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#0d8a73', fontWeight: 600, marginBottom: '4px' }}>{conv.service}</div>
                  <div style={{ fontSize: '0.85rem', color: conv.unread > 0 ? '#334155' : '#64748b', fontWeight: conv.unread > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg?.text || 'No messages yet'}
                  </div>
                </div>
                {conv.unread > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                      {conv.unread} unread
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {filteredConversations.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.95rem' }}>
              No messages yet.
            </div>
          )}
        </div>
      </div>

      {/* Active Conversation Area */}
      <div className="dashboard-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0d8a73', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {activeChat.avatar}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{activeChat.customerName}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Inquiry: <span style={{ color: '#0d8a73', fontWeight: 600 }}>{activeChat.service}</span></div>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flexGrow: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff' }}>
              
              {activeChat.messages.map(msg => {
                const isVendor = msg.sender === 'VENDOR';
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: '12px', maxWidth: '80%', alignSelf: isVendor ? 'flex-end' : 'flex-start', flexDirection: isVendor ? 'row-reverse' : 'row' }}>
                    {!isVendor && (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0d8a73', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {activeChat.avatar}
                      </div>
                    )}
                    <div>
                      <div style={{ 
                        background: isVendor ? '#0d8a73' : '#f1f5f9', 
                        color: isVendor ? '#fff' : '#334155', 
                        padding: '12px 16px', 
                        borderRadius: '16px', 
                        borderTopLeftRadius: isVendor ? '16px' : '4px',
                        borderTopRightRadius: isVendor ? '4px' : '16px',
                        fontSize: '0.95rem', 
                        lineHeight: 1.5 
                      }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textAlign: isVendor ? 'right' : 'left' }}>
                        {msg.time}
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>

            {/* Chat Input */}
            <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Type your message..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ flexGrow: 1, padding: '14px 20px', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', fontSize: '0.95rem', outline: 'none' }}
                />
                <button 
                  onClick={handleSendMessage}
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '50%', 
                    background: newMessage.trim() ? '#0d8a73' : '#e2e8f0', 
                    color: '#fff', 
                    border: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <Send size={20} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', flexDirection: 'column', gap: '16px' }}>
            <MessageCircle size={48} color="#cbd5e1" />
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select a conversation to start messaging</div>
          </div>
        )}
      </div>

    </div>
  );
};
