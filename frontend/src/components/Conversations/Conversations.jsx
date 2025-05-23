import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiPhone, FiMail, FiPaperclip, FiSend } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './Conversations.css';

const Conversations = () => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const convData = await import('../../mockData/conversations.json');
      const guestsData = await import('../../mockData/guests.json');
      
      const enrichedConversations = convData.conversations.map(conv => {
        const guest = guestsData.guests.find(g => g.id === conv.guestId);
        return { ...conv, guestData: guest };
      });
      
      setConversations(enrichedConversations);
      if (enrichedConversations.length > 0) {
        setSelectedConversation(enrichedConversations[1]);
      }
    };

    loadData();
  }, []);

  const handleTaskToggle = (task) => {
    setSelectedTasks(prev => 
      prev.includes(task) 
        ? prev.filter(t => t !== task)
        : [...prev, task]
    );
  };

  return (
    <div className="conversations">
      <div className="conversations-header">
        <h1>{t('conversations.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder={t('common.search')} />
          </div>
          <button className="filter-btn">
            <FiFilter /> {t('common.filter')}
          </button>
          <div className="status-indicator">
            <span className="status-dot online"></span>
            <span>{t('conversations.online')}</span>
          </div>
        </div>
      </div>

      <div className="conversations-layout">
        {/* Conversations List */}
        <div className="conversations-list">
          {conversations.map(conv => (
            <div 
              key={conv.id}
              className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${conv.unread ? 'unread' : ''}`}
              onClick={() => setSelectedConversation(conv)}
            >
              <img 
                src={`https://i.pravatar.cc/48?img=${conv.id + 40}`} 
                alt={conv.guest} 
                className="guest-avatar"
              />
              <div className="conversation-info">
                <h4>{conv.guest}</h4>
                <p>{conv.lastMessage}</p>
                {conv.unread && <span className="unread-indicator">2</span>}
              </div>
              {conv.status === 'online' && <span className="online-status"></span>}
            </div>
          ))}
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {selectedConversation && (
            <>
              <div className="chat-header">
                <div className="chat-guest-info">
                  <img 
                    src={`https://i.pravatar.cc/48?img=${selectedConversation.id + 40}`} 
                    alt={selectedConversation.guest} 
                  />
                  <div>
                    <h3>{selectedConversation.guest}</h3>
                    {selectedConversation.room && (
                      <p>{t('rooms.room')}: {selectedConversation.room} • {selectedConversation.checkIn} — {selectedConversation.checkOut}</p>
                    )}
                  </div>
                  {selectedConversation.status === 'online' && (
                    <span className="online-badge">• {t('conversations.online')}</span>
                  )}
                </div>
                <button className="create-task-btn" onClick={() => setShowTaskPanel(true)}>
                  {t('conversations.createTask')}
                </button>
                <button className="close-btn">
                  <FiX />
                </button>
              </div>

              <div className="messages-container">
                {selectedConversation.messages?.map(msg => (
                  <div key={msg.id} className={`message ${msg.sender === 'hotel' ? 'sent' : 'received'}`}>
                    {msg.sender === 'guest' && (
                      <div className="message-header">
                        <span className="message-sender">{selectedConversation.guest}</span>
                        <span className="message-time">{msg.time}</span>
                      </div>
                    )}
                    <p>{msg.text}</p>
                    {msg.images && (
                      <div className="message-images">
                        {msg.images.map((img, i) => (
                          <div key={i} className="image-placeholder"></div>
                        ))}
                      </div>
                    )}
                    {msg.sender === 'hotel' && (
                      <div className="message-footer">
                        <span className="message-sender">{t('conversations.youAssigned')}</span>
                        <span className="message-time">{msg.time} {msg.reaction && `(${t('conversations.reaction')} ${msg.reaction} ${t('conversations.seconds')})`}</span>
                      </div>
                    )}
                  </div>
                ))}
                {!selectedConversation.messages?.length && (
                  <div className="no-messages">
                    <p>
                      {selectedConversation.status === 'expired' 
                        ? t('conversations.expiredChats') 
                        : t('conversations.noMessagesYet')
                      }
                    </p>
                  </div>
                )}
              </div>

              <div className="message-input">
                <input 
                  type="text" 
                  placeholder={t('conversations.replyPlaceholder')}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <button className="attach-btn">
                  <FiPaperclip />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Guest Details Panel */}
        <div className={`guest-panel ${showTaskPanel ? 'show-tasks' : ''}`}>
          {selectedConversation?.guestData && (
            <>
              <div className="guest-header">
                <img 
                  src={`https://i.pravatar.cc/100?img=${selectedConversation.id + 40}`} 
                  alt={selectedConversation.guest} 
                />
                <h2>{selectedConversation.guest}</h2>
                <span className="trusted-badge">{t('conversations.trusted')}</span>
                <div className="guest-actions">
                  <button><FiPhone /> {t('conversations.call')}</button>
                  <button><FiMail /> {t('conversations.email')}</button>
                </div>
              </div>

              <div className="guest-details">
                <div className="detail-tabs">
                  <button className="active">{t('guests.guestDetails')}</button>
                  <button>{t('guests.stayDetails')}</button>
                  <button>{t('guests.history')}</button>
                  <button>{t('guests.notes')}</button>
                  <button>{t('guests.documents')}</button>
                </div>

                <div className="detail-content">
                  <section>
                    <h4>{t('guests.contactInformation')}</h4>
                    <div className="detail-row">
                      <label>{t('guests.firstName')}</label>
                      <span>{selectedConversation.guestData.firstName}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.lastName')}</label>
                      <span>{selectedConversation.guestData.lastName}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.email')}</label>
                      <span>{selectedConversation.guestData.email}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.phone')}</label>
                      <span>{selectedConversation.guestData.phone}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.sex')}</label>
                      <span>{selectedConversation.guestData.sex}</span>
                    </div>
                  </section>

                  <section>
                    <h4>{t('guests.address')}</h4>
                    <div className="detail-row">
                      <label>{t('guests.country')}</label>
                      <span>{selectedConversation.guestData.country}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.city')}</label>
                      <span>{selectedConversation.guestData.city}</span>
                    </div>
                    <div className="detail-row">
                      <label>{t('guests.address')}</label>
                      <span>{selectedConversation.guestData.address}</span>
                    </div>
                  </section>

                  {selectedConversation.guestData.spouse && (
                    <section>
                      <h4>{t('guests.familyMembers')}</h4>
                      <div className="detail-row">
                        <label>{t('guests.spouse')}</label>
                        <span className="family-member">
                          <img src="https://i.pravatar.cc/24?img=60" alt={t('guests.spouse')} />
                          {selectedConversation.guestData.spouse}
                        </span>
                      </div>
                      {selectedConversation.guestData.children?.map((child, i) => (
                        <div key={i} className="detail-row">
                          <label>{t('guests.child')} {i + 1}</label>
                          <span className="family-member">
                            <img src={`https://i.pravatar.cc/24?img=${61+i}`} alt={child} />
                            {child}
                          </span>
                        </div>
                      ))}
                    </section>
                  )}
                </div>

                {showTaskPanel && (
                  <div className="tasks-panel">
                    <h4>{t('conversations.tasks')}</h4>
                    <div className="task-options">
                      <label>
                        <input 
                          type="checkbox" 
                          onChange={() => handleTaskToggle('clean')}
                          checked={selectedTasks.includes('clean')}
                        />
                        {t('conversations.cleanRoom')}
                      </label>
                      <label>
                        <input 
                          type="checkbox"
                          onChange={() => handleTaskToggle('linen')}
                          checked={selectedTasks.includes('linen')}
                        />
                        {t('conversations.changeLinenTowels')}
                      </label>
                      <label>
                        <input 
                          type="checkbox"
                          onChange={() => handleTaskToggle('bottle')}
                          checked={selectedTasks.includes('bottle')}
                        />
                        {t('conversations.complimentaryWine')}
                      </label>
                    </div>
                    <button className="all-tasks-btn">{t('conversations.allTasks')}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Conversations;