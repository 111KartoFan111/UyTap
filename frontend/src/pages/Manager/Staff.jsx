import { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiSearch, 
  FiFilter, 
  FiEdit2, 
  FiTrash2, 
  FiEye, 
  FiMail, 
  FiPhone,
  FiX,
  FiUser,
  FiShield,
  FiClock,
  FiBarChart2
} from 'react-icons/fi';
import { useData } from '../../contexts/DataContext';
import './Pages.css';

const Staff = () => {
  const { organization, utils } = useData();
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    pendingStaff: 0,
    roleDistribution: {}
  });

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    loadStaff();
  }, []);

  // Фильтрация при изменении поисковых параметров
  useEffect(() => {
    filterStaff();
  }, [staff, searchTerm, roleFilter, statusFilter]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const staffData = await organization.getUsers({ limit: 200 });
      setStaff(staffData);
      calculateStats(staffData);
    } catch (error) {
      console.error('Failed to load staff:', error);
      utils.showError('Не удалось загрузить список сотрудников');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (staffData) => {
    const activeStaff = staffData.filter(user => user.status === 'active').length;
    const pendingStaff = staffData.filter(user => user.status === 'pending_verification').length;
    
    const roleDistribution = staffData.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    setStats({
      totalStaff: staffData.length,
      activeStaff,
      pendingStaff,
      roleDistribution
    });
  };

  const filterStaff = () => {
    let filtered = staff;

    // Фильтр по поисковому запросу
    if (searchTerm) {
      filtered = filtered.filter(user => 
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по роли
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredStaff(filtered);
  };

  const handleCreateUser = async (userData) => {
    try {
      const newUser = await organization.createUser(userData);
      setStaff(prev => [newUser, ...prev]);
      setShowUserModal(false);
      setSelectedUser(null);
      utils.showSuccess('Сотрудник успешно создан');
    } catch (error) {
      console.error('Failed to create user:', error);
      utils.showError('Не удалось создать сотрудника');
    }
  };

  const handleUpdateUser = async (userData) => {
    try {
      const updatedUser = await organization.updateUser(selectedUser.id, userData);
      setStaff(prev => prev.map(user => 
        user.id === selectedUser.id ? updatedUser : user
      ));
      setShowUserModal(false);
      setSelectedUser(null);
      utils.showSuccess('Сотрудник обновлен');
    } catch (error) {
      console.error('Failed to update user:', error);
      utils.showError('Не удалось обновить сотрудника');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;

    try {
      await organization.deleteUser(userId);
      setStaff(prev => prev.filter(user => user.id !== userId));
      utils.showSuccess('Сотрудник удален');
    } catch (error) {
      console.error('Failed to delete user:', error);
      utils.showError('Не удалось удалить сотрудника');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!confirm('Вы уверены, что хотите сбросить пароль для этого сотрудника?')) return;

    try {
      await organization.resetUserPassword(userId);
      utils.showSuccess('Пароль сброшен. Новый пароль отправлен сотруднику');
    } catch (error) {
      console.error('Failed to reset password:', error);
      utils.showError('Не удалось сбросить пароль');
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      system_owner: 'Владелец системы',
      admin: 'Администратор',
      manager: 'Менеджер',
      technical_staff: 'Технический персонал',
      accountant: 'Бухгалтер',
      cleaner: 'Уборщик',
      storekeeper: 'Кладовщик'
    };
    return roleNames[role] || role;
  };

  const getStatusDisplayName = (status) => {
    const statusNames = {
      active: 'Активен',
      inactive: 'Неактивен',
      suspended: 'Заблокирован',
      pending_verification: 'Ожидает подтверждения'
    };
    return statusNames[status] || status;
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      active: 'status-active',
      inactive: 'status-inactive',
      suspended: 'status-suspended',
      pending_verification: 'status-pending'
    };
    return classes[status] || 'status-default';
  };

  const roles = [
    { value: 'all', label: 'Все роли' },
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  const statuses = [
    { value: 'all', label: 'Все статусы' },
    { value: 'active', label: 'Активные' },
    { value: 'inactive', label: 'Неактивные' },
    { value: 'suspended', label: 'Заблокированные' },
    { value: 'pending_verification', label: 'Ожидают подтверждения' }
  ];

  if (loading) {
    return (
      <div className="staff-page loading">
        <div className="loading-spinner"></div>
        <p>Загрузка сотрудников...</p>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <div className="page-header">
        <h1>Управление персоналом</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Поиск сотрудников..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                <FiX />
              </button>
            )}
          </div>
          
          <div className="filter-group">
            <FiFilter />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {roles.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className="btn-primary"
            onClick={() => {
              setSelectedUser(null);
              setShowUserModal(true);
            }}
          >
            <FiPlus /> Добавить сотрудника
          </button>
        </div>
      </div>
      
      <div className="staff-stats">
        <div className="stat-card">
          <h3>Всего сотрудников</h3>
          <div className="stat-number">{stats.totalStaff}</div>
        </div>
        <div className="stat-card">
          <h3>Активных</h3>
          <div className="stat-number">{stats.activeStaff}</div>
        </div>
        <div className="stat-card">
          <h3>Ожидают подтверждения</h3>
          <div className="stat-number">{stats.pendingStaff}</div>
        </div>
        <div className="stat-card">
          <h3>Администраторов</h3>
          <div className="stat-number">{stats.roleDistribution.admin || 0}</div>
        </div>
      </div>

      <div className="staff-table-wrapper">
        {filteredStaff.length > 0 ? (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Роль</th>
                <th>Контакты</th>
                <th>Статус</th>
                <th>Последний вход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        <FiUser />
                      </div>
                      <div className="user-details">
                        <div className="user-name">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      <FiShield size={12} />
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td>
                    <div className="user-contacts">
                      {user.phone && (
                        <div className="contact-item">
                          <FiPhone size={14} />
                          <a href={`tel:${user.phone}`}>{user.phone}</a>
                        </div>
                      )}
                      <div className="contact-item">
                        <FiMail size={14} />
                        <a href={`mailto:${user.email}`}>{user.email}</a>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>
                      {getStatusDisplayName(user.status)}
                    </span>
                  </td>
                  <td>
                    <div className="last-activity">
                      <FiClock size={14} />
                      {formatDate(user.last_login_at)}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-icon view"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserModal(true);
                        }}
                        title="Просмотр"
                      >
                        <FiEye />
                      </button>
                      <button 
                        className="btn-icon edit"
                        onClick={() => handleEditUser(user)}
                        title="Редактировать"
                      >
                        <FiEdit2 />
                      </button>
                      <button 
                        className="btn-icon reset"
                        onClick={() => handleResetPassword(user.id)}
                        title="Сбросить пароль"
                      >
                        🔑
                      </button>
                      <button 
                        className="btn-icon delete"
                        onClick={() => handleDeleteUser(user.id)}
                        title="Удалить"
                        disabled={user.role === 'system_owner'}
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-staff">
            <div className="empty-state">
              <FiUser size={48} />
              <h3>
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Сотрудники не найдены' 
                  : 'Нет сотрудников'
                }
              </h3>
              <p>
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Попробуйте изменить условия поиска'
                  : 'Добавьте первого сотрудника для начала работы'
                }
              </p>
              {(!searchTerm && roleFilter === 'all' && statusFilter === 'all') && (
                <button 
                  className="btn-primary"
                  onClick={() => {
                    setSelectedUser(null);
                    setShowUserModal(true);
                  }}
                >
                  <FiPlus /> Добавить первого сотрудника
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showUserModal && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}
        />
      )}
    </div>
  );
};

// Компонент модального окна для создания/редактирования пользователя
const UserModal = ({ user, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    phone: '',
    role: 'manager',
    status: 'active'
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: '', // Не показываем существующий пароль
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        middle_name: user.middle_name || '',
        phone: user.phone || '',
        role: user.role || 'manager',
        status: user.status || 'active'
      });
    }
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }

    if (!user && !formData.password.trim()) {
      newErrors.password = 'Пароль обязателен для нового пользователя';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Пароль должен содержать минимум 8 символов';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Фамилия обязательна';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      const submitData = { ...formData };
      
      // Для редактирования удаляем пустой пароль
      if (user && !submitData.password) {
        delete submitData.password;
      }

      // Очищаем пустые поля
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null;
        }
      });

      onSubmit(submitData);
    }
  };

  const roles = [
    { value: 'admin', label: 'Администратор' },
    { value: 'manager', label: 'Менеджер' },
    { value: 'technical_staff', label: 'Технический персонал' },
    { value: 'accountant', label: 'Бухгалтер' },
    { value: 'cleaner', label: 'Уборщик' },
    { value: 'storekeeper', label: 'Кладовщик' }
  ];

  const statuses = [
    { value: 'active', label: 'Активен' },
    { value: 'inactive', label: 'Неактивен' },
    { value: 'suspended', label: 'Заблокирован' },
    { value: 'pending_verification', label: 'Ожидает подтверждения' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FiUser /> {user ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <form className="user-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Личная информация</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Имя *</label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Имя"
                  className={errors.first_name ? 'error' : ''}
                />
                {errors.first_name && <span className="error-text">{errors.first_name}</span>}
              </div>

              <div className="form-field">
                <label>Фамилия *</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Фамилия"
                  className={errors.last_name ? 'error' : ''}
                />
                {errors.last_name && <span className="error-text">{errors.last_name}</span>}
              </div>

              <div className="form-field">
                <label>Отчество</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  placeholder="Отчество"
                />
              </div>

              <div className="form-field">
                <label>Телефон</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (777) 123-45-67"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Учетные данные</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className={errors.email ? 'error' : ''}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              <div className="form-field">
                <label>{user ? 'Новый пароль (оставьте пустым для сохранения текущего)' : 'Пароль *'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Минимум 8 символов"
                  className={errors.password ? 'error' : ''}
                />
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>

              <div className="form-field">
                <label>Роль</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Статус</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {statuses.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              {user ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Staff;