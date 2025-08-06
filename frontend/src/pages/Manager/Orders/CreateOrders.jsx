import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useData } from '../../../contexts/DataContext.jsx';


const InventoryCheck = () => {
  const { user } = useAuth();
  const { orders,inventory, tasks, utils } = useData();

  return (
    <div>
      <h1>Inventory Check</h1>
      {/* Add your inventory check content here */}
    </div>
  );
};

export default InventoryCheck;