import { useState } from 'react';
import { FiPlus, FiSearch, FiFilter } from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import ClientModal from './ClientModal';

const Clients = () => {
  const { clients } = useData();
  const [showClientModal, setShowClientModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="clients-page">
      <div className="page-header">
        <h1>База клиентов</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск клиентов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="filter-btn">
            <FiFilter /> Фильтр
          </button>
          <button 
            className="btn-primary"
            onClick={() => setShowClientModal(true)}
          >
            <FiPlus /> Добавить клиента
          </button>
        </div>
      </div>
      
      <div className="clients-stats">
        <div className="stat-card">
          <h3>Всего клиентов</h3>
          <div className="stat-number">156</div>
        </div>
        <div className="stat-card">
          <h3>Новые за месяц</h3>
          <div className="stat-number">23</div>
        </div>
        <div className="stat-card">
          <h3>Активные аренды</h3>
          <div className="stat-number">45</div>
        </div>
      </div>

      <div className="clients-table-wrapper">
        <table className="clients-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Последний визит</th>
              <th>Источник</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Иван Иванов</td>
              <td>+7 777 123 45 67</td>
              <td>ivan@example.com</td>
              <td>15.11.2024</td>
              <td>Прямое обращение</td>
              <td>
                <button className="btn-icon">Редактировать</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showClientModal && (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSubmit={(data) => {
            console.log('New client:', data);
            setShowClientModal(false);
          }}
        />
      )}
    </div>
  );
};
export default Clients;