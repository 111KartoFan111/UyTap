// frontend/src/pages/Storekeeper/StorekeeperDashboard.jsx
import { useState, useEffect } from 'react';
import { 
  FiPackage, 
  FiTrendingDown, 
  FiAlertCircle,
  FiPlus,
  FiMinus,
  FiList
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const StorekeeperDashboard = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([
    { id: 1, name: 'Постельное белье', quantity: 45, minQuantity: 20, unit: 'комплект' },
    { id: 2, name: 'Полотенца', quantity: 8, minQuantity: 15, unit: 'шт' },
    { id: 3, name: 'Моющие средства', quantity: 25, minQuantity: 10, unit: 'л' },
    { id: 4, name: 'Туалетная бумага', quantity: 120, minQuantity: 50, unit: 'рулон' },
    { id: 5, name: 'Шампунь', quantity: 15, minQuantity: 20, unit: 'бутылка' }
  ]);

  const lowStockItems = inventory.filter(item => item.quantity <= item.minQuantity);

  return (
    <div className="storekeeper-dashboard">
      <div className="dashboard-header">
        <h1>Управление складом</h1>
        <div className="user-greeting">Привет, {user.first_name}!</div>
      </div>

      <div className="inventory-stats">
        <div className="stat-card total">
          <FiPackage />
          <div>
            <h3>Всего товаров</h3>
            <div className="number">{inventory.length}</div>
          </div>
        </div>
        
        <div className="stat-card low-stock">
          <FiAlertCircle />
          <div>
            <h3>Заканчивается</h3>
            <div className="number">{lowStockItems.length}</div>
          </div>
        </div>
        
        <div className="stat-card operations">
          <FiList />
          <div>
            <h3>Операций сегодня</h3>
            <div className="number">12</div>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="low-stock-alert">
          <h2><FiAlertCircle /> Требует пополнения</h2>
          <div className="alert-items">
            {lowStockItems.map(item => (
              <div key={item.id} className="alert-item">
                <span className="item-name">{item.name}</span>
                <span className="item-quantity">
                  Осталось: {item.quantity} {item.unit}
                </span>
                <button className="btn-order">Заказать</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="inventory-section">
        <h2>Склад материалов</h2>
        <div className="inventory-table">
          <table>
            <thead>
              <tr>
                <th>Наименование</th>
                <th>Количество</th>
                <th>Единица</th>
                <th>Мин. остаток</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => (
                <tr key={item.id} className={item.quantity <= item.minQuantity ? 'low-stock' : ''}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{item.minQuantity}</td>
                  <td>
                    <button className="btn-icon"><FiPlus /></button>
                    <button className="btn-icon"><FiMinus /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StorekeeperDashboard;