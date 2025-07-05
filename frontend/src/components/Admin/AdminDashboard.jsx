import { useState, useEffect } from 'react';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiUsers, 
  FiHome, // Заменяем FaBuilding на FiHome
  FiSettings,
  FiEye,
  FiUserPlus,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import CreateOrganizationModal from './CreateOrganizationModal';
import CreateUserModal from './CreateUserModal';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('organizations'); // 'organizations' | 'users'

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      loadUsers(selectedOrg.id);
    }
  }, [selectedOrg]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/admin/organizations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0 && !selectedOrg) {
          setSelectedOrg(data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (orgId) => {
    try {
      const response = await fetch(`http://localhost:8000/api/admin/organizations/${orgId}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateOrganization = async (orgData) => {
    try {
      const response = await fetch('http://localhost:8000/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(orgData),
      });

      if (response.ok) {
        const newOrg = await response.json();
        setOrganizations([...organizations, newOrg]);
        setShowCreateOrgModal(false);
      }
    } catch (error) {
      console.error('Error creating organization:', error);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      const response = await fetch(`http://localhost:8000/api/admin/organizations/${selectedOrg.id}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const newUser = await response.json();
        setUsers([...users, newUser]);
        setShowCreateUserModal(false);
      }
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleDeleteOrganization = async (orgId) => {
    if (!confirm('Вы уверены что хотите удалить эту организацию?')) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/admin/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setOrganizations(organizations.filter(org => org.id !== orgId));
        if (selectedOrg?.id === orgId) {
          setSelectedOrg(organizations[0] || null);
        }
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Вы уверены что хотите удалить этого пользователя?')) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        setUsers(users.filter(user => user.id !== userId));
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'active': return 'status-active';
      case 'trial': return 'status-trial';
      case 'suspended': return 'status-suspended';
      case 'expired': return 'status-expired';
      default: return 'status-inactive';
    }
  };

  const getRoleBadgeClass = (role) => {
    switch(role) {
      case 'system_owner': return 'role-system-owner';
      case 'admin': return 'role-admin';
      case 'manager': return 'role-manager';
      default: return 'role-staff';
    }
  };

  if (loading) {
    return <div className="admin-loading">Загрузка...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Администрирование системы</h1>
        <div className="admin-actions">
          <button 
            className="btn-primary"
            onClick={() => setShowCreateOrgModal(true)}
          >
            <FiPlus /> Создать организацию
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-sidebar">
          <div className="organizations-list">
            <div className="sidebar-header">
              <h3>
                Организации ({organizations.length})
              </h3>
              <div className="search-box">
                <FiSearch />
                <input type="text" placeholder="Поиск организаций..." />
              </div>
            </div>
            
            <div className="organizations-items">
              {organizations.map(org => (
                <div 
                  key={org.id}
                  className={`organization-item ${selectedOrg?.id === org.id ? 'active' : ''}`}
                  onClick={() => setSelectedOrg(org)}
                >
                  <div className="org-info">
                    <h4>{org.name}</h4>
                    <p>{org.slug}</p>
                    <span className={`status-badge ${getStatusBadgeClass(org.status)}`}>
                      {org.status}
                    </span>
                  </div>
                  <div className="org-actions">
                    <button onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOrganization(org.id);
                    }}>
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-main">
          {selectedOrg ? (
            <>
              <div className="org-details">
                <div className="org-details-header">
                  <div className="org-title">
                    <h2>{selectedOrg.name}</h2>
                    <span className={`status-badge ${getStatusBadgeClass(selectedOrg.status)}`}>
                      {selectedOrg.status}
                    </span>
                  </div>
                  <div className="org-actions">
                    <button 
                      className="btn-outline"
                      onClick={() => setShowCreateUserModal(true)}
                    >
                      <FiUserPlus /> Добавить сотрудника
                    </button>
                    <button className="btn-outline">
                      <FiEdit2 /> Редактировать
                    </button>
                  </div>
                </div>

                <div className="org-info-grid">
                  <div className="info-card">
                    <h4>Основная информация</h4>
                    <div className="info-rows">
                      <div className="info-row">
                        <label>Название:</label>
                        <span>{selectedOrg.name}</span>
                      </div>
                      <div className="info-row">
                        <label>Slug:</label>
                        <span>{selectedOrg.slug}</span>
                      </div>
                      <div className="info-row">
                        <label>Email:</label>
                        <span>{selectedOrg.email}</span>
                      </div>
                      <div className="info-row">
                        <label>Телефон:</label>
                        <span>{selectedOrg.phone}</span>
                      </div>
                      <div className="info-row">
                        <label>Сайт:</label>
                        <span>{selectedOrg.website}</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-card">
                    <h4>Адрес</h4>
                    <div className="info-rows">
                      <div className="info-row">
                        <label>Страна:</label>
                        <span>{selectedOrg.country}</span>
                      </div>
                      <div className="info-row">
                        <label>Город:</label>
                        <span>{selectedOrg.city}</span>
                      </div>
                      <div className="info-row">
                        <label>Адрес:</label>
                        <span>{selectedOrg.address}</span>
                      </div>
                      <div className="info-row">
                        <label>Индекс:</label>
                        <span>{selectedOrg.postal_code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-card">
                    <h4>Подписка</h4>
                    <div className="info-rows">
                      <div className="info-row">
                        <label>План:</label>
                        <span>{selectedOrg.subscription_plan}</span>
                      </div>
                      <div className="info-row">
                        <label>Макс. пользователей:</label>
                        <span>{selectedOrg.max_users}</span>
                      </div>
                      <div className="info-row">
                        <label>Макс. объектов:</label>
                        <span>{selectedOrg.max_properties}</span>
                      </div>
                      <div className="info-row">
                        <label>Создана:</label>
                        <span>{new Date(selectedOrg.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="users-section">
                <div className="users-header">
                  <h3>
                    <FiUsers /> Сотрудники ({users.length})
                  </h3>
                  <div className="users-controls">
                    <div className="search-box">
                      <FiSearch />
                      <input type="text" placeholder="Поиск сотрудников..." />
                    </div>
                    <button className="btn-outline">
                      <FiFilter /> Фильтр
                    </button>
                    <button 
                        className="btn-primary"
                        onClick={() => setShowCreateUserModal(true)}
                        >
                        <FiUserPlus /> Добавить сотрудника
                    </button>
                  </div>
                </div>

                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Последний вход</th>
                        <th>Создан</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-name">
                              <strong>{user.first_name} {user.last_name}</strong>
                              {user.middle_name && <small>{user.middle_name}</small>}
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>{user.phone || '—'}</td>
                          <td>
                            <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(user.status)}`}>
                              {user.status}
                            </span>
                          </td>
                          <td>
                            {user.last_login_at 
                              ? new Date(user.last_login_at).toLocaleDateString()
                              : '—'
                            }
                          </td>
                          <td>{new Date(user.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="table-actions">
                              <button className="btn-icon" title="Редактировать">
                                <FiEdit2 />
                              </button>
                              <button 
                                className="btn-icon btn-danger" 
                                title="Удалить"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="no-organization">
              <FiHome size={48} />
              <h3>Выберите организацию</h3>
              <p>Выберите организацию из списка слева для просмотра информации</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальные окна */}
      {showCreateOrgModal && (
        <CreateOrganizationModal
          onClose={() => setShowCreateOrgModal(false)}
          onSubmit={handleCreateOrganization}
        />
      )}

      {showCreateUserModal && selectedOrg && (
        <CreateUserModal
          organizationId={selectedOrg.id}
          onClose={() => setShowCreateUserModal(false)}
          onSubmit={handleCreateUser}
        />
      )}
    </div>
  );
};

export default AdminDashboard;