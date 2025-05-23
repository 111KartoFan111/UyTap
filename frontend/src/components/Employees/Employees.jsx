import { useState, useEffect } from 'react';
import { FiSearch, FiFilter, FiX, FiEdit2, FiPhone, FiMail } from 'react-icons/fi';
import { useTranslation } from '../../contexts/LanguageContext';
import './Employees.css';

const Employees = () => {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showAllEmployees, setShowAllEmployees] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // Mock data для сотрудников
      const employeesData = {
        employees: [
          {
            id: 1,
            firstName: "Анна",
            lastName: "Цибуйская",
            email: "anna.cibuiskaya@hotel.com",
            phone: "+7 (777) 123-45-67",
            position: "Менеджер",
            department: "Администрация",
            hireDate: "2022-01-15",
            salary: 250000,
            status: "Активный",
            workSchedule: "Полный день",
            avatar: null
          },
          {
            id: 2,
            firstName: "Мария",
            lastName: "Петрова",
            email: "maria.petrova@hotel.com",
            phone: "+7 (777) 234-56-78",
            position: "Горничная",
            department: "Хозяйственная служба",
            hireDate: "2021-05-20",
            salary: 120000,
            status: "Активный",
            workSchedule: "Полный день",
            avatar: null
          },
          {
            id: 3,
            firstName: "Алексей",
            lastName: "Иванов",
            email: "alexey.ivanov@hotel.com",
            phone: "+7 (777) 345-67-89",
            position: "Портье",
            department: "Служба приема",
            hireDate: "2020-09-10",
            salary: 180000,
            status: "Активный",
            workSchedule: "Сменный",
            avatar: null
          },
          {
            id: 4,
            firstName: "Елена",
            lastName: "Сидорова",
            email: "elena.sidorova@hotel.com",
            phone: "+7 (777) 456-78-90",
            position: "Повар",
            department: "Ресторан",
            hireDate: "2019-03-25",
            salary: 200000,
            status: "Активный",
            workSchedule: "Полный день",
            avatar: null
          },
          {
            id: 5,
            firstName: "Дмитрий",
            lastName: "Козлов",
            email: "dmitry.kozlov@hotel.com",
            phone: "+7 (777) 567-89-01",
            position: "Охранник",
            department: "Безопасность",
            hireDate: "2021-08-12",
            salary: 150000,
            status: "Активный",
            workSchedule: "Сменный",
            avatar: null
          },
          {
            id: 6,
            firstName: "Ольга",
            lastName: "Николаева",
            email: "olga.nikolaeva@hotel.com",
            phone: "+7 (777) 678-90-12",
            position: "Администратор",
            department: "Служба приема",
            hireDate: "2022-06-30",
            salary: 160000,
            status: "Активный",
            workSchedule: "Полный день",
            avatar: null
          },
          {
            id: 7,
            firstName: "Сергей",
            lastName: "Волков",
            email: "sergey.volkov@hotel.com",
            phone: "+7 (777) 789-01-23",
            position: "Технический специалист",
            department: "Техническая служба",
            hireDate: "2020-11-18",
            salary: 190000,
            status: "Отпуск",
            workSchedule: "Полный день",
            avatar: null
          },
          {
            id: 8,
            firstName: "Татьяна",
            lastName: "Морозова",
            email: "tatyana.morozova@hotel.com",
            phone: "+7 (777) 890-12-34",
            position: "Официант",
            department: "Ресторан",
            hireDate: "2023-02-14",
            salary: 130000,
            status: "Активный",
            workSchedule: "Сменный",
            avatar: null
          }
        ]
      };
      setEmployees(employeesData.employees);
    };

    loadData();
  }, []);

  const recentEmployees = employees.slice(0, 6);
  const displayedEmployees = showAllEmployees ? employees : recentEmployees;

  const getStatusColor = (status) => {
    switch(status) {
      case 'Активный': return '#27ae60';
      case 'Отпуск': return '#f39c12';
      case 'Больничный': return '#e74c3c';
      case 'Уволен': return '#95a5a6';
      default: return '#666';
    }
  };

  const getDepartmentColor = (department) => {
    switch(department) {
      case 'Администрация': return '#3498db';
      case 'Служба приема': return '#9b59b6';
      case 'Хозяйственная служба': return '#e67e22';
      case 'Ресторан': return '#e74c3c';
      case 'Безопасность': return '#34495e';
      case 'Техническая служба': return '#16a085';
      default: return '#7f8c8d';
    }
  };

  return (
    <div className="employees">
      <div className="employees-header">
        <h1>{t('employees.title')}</h1>
        <div className="header-controls">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder={t('common.search')} />
          </div>
          <button className="filter-btn">
            <FiFilter /> {t('common.filter')}
          </button>
        </div>
      </div>

      <div className="employees-content">
        <div className="employees-table-container">
          <h2>{showAllEmployees ? t('employees.allEmployees') : t('employees.recentEmployees')}</h2>
          <table className="employees-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('employees.name')}</th>
                <th>{t('employees.position')}</th>
                <th>{t('employees.department')}</th>
                <th>{t('employees.phone')}</th>
                <th>{t('employees.status')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedEmployees.map((employee) => (
                <tr key={employee.id} onClick={() => setSelectedEmployee(employee)}>
                  <td>
                    <img src={`https://i.pravatar.cc/40?img=${employee.id + 100}`} alt={employee.firstName} />
                  </td>
                  <td>{employee.firstName} {employee.lastName}</td>
                  <td>{employee.position}</td>
                  <td>
                    <span 
                      className="department-badge" 
                      style={{ backgroundColor: getDepartmentColor(employee.department) }}
                    >
                      {employee.department}
                    </span>
                  </td>
                  <td>{employee.phone}</td>
                  <td>
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: getStatusColor(employee.status) }}
                    >
                      {employee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!showAllEmployees && (
            <div className="show-all-section">
              <h2>{t('employees.allEmployees')}</h2>
              <table className="employees-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('employees.name')}</th>
                    <th>{t('employees.position')}</th>
                    <th>{t('employees.department')}</th>
                    <th>{t('employees.phone')}</th>
                    <th>{t('employees.status')}</th>
                  </tr>
                </thead>
              </table>
              <button 
                className="show-all-btn"
                onClick={() => setShowAllEmployees(true)}
              >
                {t('employees.showAllEmployees')}
              </button>
            </div>
          )}
        </div>

        {selectedEmployee && (
          <div className="employee-modal">
            <div className="modal-content">
              <div className="modal-header">
                <button className="close-modal" onClick={() => setSelectedEmployee(null)}>
                  <FiX />
                </button>
                <div className="modal-actions">
                  <button className="btn-outline">
                    <FiEdit2 /> {t('employees.editEmployee')}
                  </button>
                  <button className="btn-outline">
                    <FiPhone /> {t('employees.call')}
                  </button>
                  <button className="btn-outline">
                    <FiMail /> {t('employees.email')}
                  </button>
                </div>
              </div>

              <div className="employee-profile">
                <img 
                  src={`https://i.pravatar.cc/120?img=${selectedEmployee.id + 100}`} 
                  alt={selectedEmployee.firstName} 
                />
                <h2>{selectedEmployee.firstName} {selectedEmployee.lastName}</h2>
                <p className="employee-position">{selectedEmployee.position}</p>
                <span 
                  className="status-badge large" 
                  style={{ backgroundColor: getStatusColor(selectedEmployee.status) }}
                >
                  {selectedEmployee.status}
                </span>
              </div>

              <div className="employee-tabs">
                <button className="tab active">{t('employees.personalInfo')}</button>
                <button className="tab">{t('employees.workInfo')}</button>
                <button className="tab">{t('employees.schedule')}</button>
                <button className="tab">{t('employees.documents')}</button>
              </div>

              <div className="employee-info">
                <section>
                  <h3>{t('employees.contactInformation')}</h3>
                  <div className="info-row">
                    <label>{t('employees.firstName')}</label>
                    <span>{selectedEmployee.firstName}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.lastName')}</label>
                    <span>{selectedEmployee.lastName}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.email')}</label>
                    <span>{selectedEmployee.email}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.phone')}</label>
                    <span>{selectedEmployee.phone}</span>
                  </div>
                </section>

                <section>
                  <h3>{t('employees.workInformation')}</h3>
                  <div className="info-row">
                    <label>{t('employees.position')}</label>
                    <span>{selectedEmployee.position}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.department')}</label>
                    <span 
                      className="department-badge" 
                      style={{ backgroundColor: getDepartmentColor(selectedEmployee.department) }}
                    >
                      {selectedEmployee.department}
                    </span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.hireDate')}</label>
                    <span>{new Date(selectedEmployee.hireDate).toLocaleDateString()}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.workSchedule')}</label>
                    <span>{selectedEmployee.workSchedule}</span>
                  </div>
                  <div className="info-row">
                    <label>{t('employees.salary')}</label>
                    <span>{selectedEmployee.salary.toLocaleString()} ₸</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Employees;