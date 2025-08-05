import React, { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const MyPayroll = () => {
  const { currentUser } = useAuth();
  const { reports } = useData();

  const [payroll, setPayroll] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPayroll = async () => {
      try {
        const periodEnd = dayjs().endOf('day');
        const periodStart = dayjs().subtract(1, 'month').startOf('day');

        const data = await reports.getMyPayroll(
          periodStart.format('YYYY-MM-DDTHH:mm:ss'),
          periodEnd.format('YYYY-MM-DDTHH:mm:ss')
        );

        setPayroll(data);
      } catch (error) {
        console.error('Ошибка загрузки данных о зарплате:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPayroll();
  }, []);

  if (loading) return <div>Загрузка...</div>;
  if (!payroll) return <div>Нет данных о зарплате за выбранный период.</div>;

  return (
    <div className="my-payroll-page">
      <h1>Зарплата: {currentUser?.name}</h1>
      <div className="payroll-summary-card">
        <div className="payroll-period">
          <strong>Период:</strong> {dayjs(payroll.period_start).format('DD.MM.YYYY')} — {dayjs(payroll.period_end).format('DD.MM.YYYY')}
        </div>
        <div className="payroll-amounts">
          <p><strong>Начислено:</strong> {payroll.gross_amount} ₸</p>
          <p><strong>К выплате:</strong> {payroll.net_amount} ₸</p>
        </div>
      </div>
    </div>
  );
};

export default MyPayroll;
