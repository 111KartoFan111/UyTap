import { useState, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';

const OrderHistory = () => {
  const { orders: ordersAPI } = useData();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await ordersAPI.getAll();
        setOrders(response);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [ordersAPI]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="order-history">
       <a href={user.role === "admin" ? "/admin/orders" : "/manager/orders"}>
        <button className="btn btn-primary">Назад</button>
      </a>
      <h1>История заказов</h1>
      <p>Всего заказов: {orders.length}</p>
      <p>Последний заказ: {orders.length > 0 ? new Date(orders[0].created_at).toLocaleDateString() : 'Нет заказов'}</p>
      {orders.length === 0 ? (
        <p>Нет заказов для отображения.</p>
      ) : (
      <ul>
      {orders.map(order => (
        <li key={order.id}>
          #{order.order_number} — {order.status} — {order.total_amount} ₸
        </li>
      ))}
    </ul>
      )}
    </div>
  );
};

export default OrderHistory;
