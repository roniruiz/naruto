// Constants and configuration
const CONFIG = {
  storageKeys: {
    inventory: 'inventory',
    sales: 'sales', 
    clients: 'clients',
    movements: 'cashMovements',
    expenses: 'expenses',
    deceased: 'deceased',
    systemLogs: 'systemLogs'
  },
  notifications: {
    duration: 3000,
    position: 'top-right',
    enabled: true
  },
  apiEndpoint: '/send.php',
  storagePrefix: 'funeraria_'
};

const USER_PERMISSIONS = {
  admin: {
    canView: ['inicio', 'inventario', 'cuadre', 'reportes', 'gastos', 'clientes', 'ventas', 'seguros', 'fallecidos', 'opciones'],
    canEdit: ['inicio', 'inventario', 'cuadre', 'reportes', 'gastos', 'clientes', 'ventas', 'seguros', 'fallecidos', 'opciones']
  },
  cajero: {
    canView: ['inicio', 'ventas', 'cuadre'],
    canEdit: ['ventas', 'cuadre']
  }
};

// Add validUsers object for authentication
const validUsers = {
  admin: { password: 'admin123', name: 'Administrador', role: 'admin' },
  cajero1: { password: 'cajero1', name: 'Cajero 1', role: 'cajero' },
  cajero2: { password: 'cajero2', name: 'Cajero 2', role: 'cajero' }
};

let currentUser = null;
let currentItems = [];
let currentSale = {
  items: [],
  total: 0
};
let activeCashiers = []; // Track active users

// Initialize storage with default values if empty
function initializeStorage() {
  const keys = Object.values(CONFIG.storageKeys);
  keys.forEach(key => {
    const fullKey = CONFIG.storagePrefix + key;
    if (!localStorage.getItem(fullKey)) {
      localStorage.setItem(fullKey, JSON.stringify([]));
    }
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initializeStorage();
  setupEventListeners();
  checkLoginStatus();
  updateClientsDisplay();
  updateDeceasedDisplay();
  updateSalesDisplay();
  
  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    changeTheme(savedTheme);
  }
});

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Other form listeners
  const formIds = ['inventoryForm', 'salesForm', 'clientForm', 'deceasedForm', 'expenseForm'];
  formIds.forEach(id => {
    const form = document.getElementById(id);
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit(id, e);
      });
    }
  });

  // Sidebar toggle
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const mainContainer = document.getElementById('mainContainer');

  if (sidebarToggle && sidebar && backdrop && mainContainer) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      backdrop.classList.toggle('active');
      mainContainer.classList.toggle('sidebar-active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('active');
      backdrop.classList.remove('active');
      mainContainer.classList.remove('sidebar-active');
    });
  }

  // Menu links
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.currentTarget.dataset.section;
      showSection(section);
      
      if (section === 'fallecidos') {
        updateDeceasedDisplay();
      }
    });
  });
}

function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  if (!username || !password) {
    showNotification('Ingrese usuario y contraseña', 'warning');
    return;
  }

  const user = validUsers[username];
  if (user && user.password === password) {
    currentUser = {
      username: username,
      name: user.name,
      role: user.role
    };
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    if (!activeCashiers.some(cashier => cashier.username === username)) {
      activeCashiers.push(currentUser);
    }
    
    document.getElementById('loginContainer').classList.add('d-none');
    document.getElementById('mainContainer').classList.remove('d-none');
    document.getElementById('welcomeUserName').textContent = user.name;
    
    // Hide unauthorized menu items for cashiers
    if (user.role === 'cajero') {
      document.querySelectorAll('.sidebar-menu a').forEach(link => {
        const section = link.dataset.section;
        if (!USER_PERMISSIONS.cajero.canView.includes(section)) {
          link.parentElement.style.display = 'none';
        }
      });
    }
    
    showSection('inicio');
    showNotification('Bienvenido ' + user.name, 'success');
    updateDashboard();
  } else {
    showNotification('Credenciales inválidas', 'error');
  }
}

function checkLoginStatus() {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    // User is logged in
    currentUser = JSON.parse(storedUser);
    document.getElementById('loginContainer').classList.add('d-none');
    document.getElementById('mainContainer').classList.remove('d-none');
    document.getElementById('welcomeUserName').textContent = currentUser.name;
    
    showSection('inicio');
    updateDashboard();
    updateInventoryDisplay();
    updateSalesDisplay();
    updateClientsDisplay();
  } else {
    // No user logged in
    document.getElementById('loginContainer').classList.remove('d-none');
    document.getElementById('mainContainer').classList.add('d-none');
  }
}

function handleFormSubmit(formId, e) {
    try {
        e.preventDefault();
        
        // Check if user is admin for form submissions
        if (currentUser && currentUser.role !== 'admin' && 
            (formId === 'clientForm' || formId === 'inventoryForm' || 
             formId === 'deceasedForm' || formId === 'expenseForm')) {
            showNotification('Solo el administrador puede realizar esta acción', 'warning');
            return;
        }
        
        const form = e.target;
        let data = {};
        
        if (formId === 'clientForm') {
            data = {
                name: document.getElementById('clientName').value,
                documentId: document.getElementById('clientId').value,
                phone: document.getElementById('clientPhone').value,  
                address: document.getElementById('clientAddress').value,
                email: document.getElementById('clientEmail').value || '',
                createdBy: currentUser ? currentUser.username : 'system'
            };

            if (!data.name || !data.documentId || !data.phone || !data.address) {
                showNotification('Por favor complete todos los campos requeridos', 'warning');
                return;
            }

            const storageKey = CONFIG.storagePrefix + 'clients';
            const clients = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            if (form.dataset.editing === 'true' && form.dataset.editId) {
                // Update existing client
                const editId = parseInt(form.dataset.editId);
                const index = clients.findIndex(client => client.id === editId);
                
                if (index !== -1) {
                    data.id = editId;
                    data.createdAt = clients[index].createdAt;
                    data.updatedAt = new Date().toISOString();
                    clients[index] = data;
                    showNotification('Cliente actualizado exitosamente', 'success');
                }
            } else {
                // Add new client
                data.id = Date.now();
                data.createdAt = new Date().toISOString();
                clients.push(data);
                showNotification('Cliente agregado exitosamente', 'success');
            }
            
            localStorage.setItem(storageKey, JSON.stringify(clients));
            form.reset();
            
            // Reset form state
            form.dataset.editing = 'false';
            form.dataset.editId = '';
            
            // Close modal if exists
            const modal = bootstrap.Modal.getInstance(document.getElementById('addClientModal'));
            if(modal) {
                modal.hide();
            }
            
            updateClientsDisplay();
        } else if (formId === 'inventoryForm') {
            data = {
                type: document.getElementById('itemType') ? document.getElementById('itemType').value : 'caja',
                name: document.getElementById('itemName') ? document.getElementById('itemName').value : document.getElementById('itemNameInput').value,
                quantity: parseInt(document.getElementById('itemQuantity') ? document.getElementById('itemQuantity').value : document.getElementById('itemQuantityInput').value) || 0,
                price: parseFloat(document.getElementById('itemPrice') ? document.getElementById('itemPrice').value : document.getElementById('itemPriceInput').value) || 0,
                status: document.getElementById('itemStatus') ? document.getElementById('itemStatus').value : 'disponible',
                createdBy: currentUser ? currentUser.username : 'system'
            };

            // Validate data
            if (!data.name) {
                showNotification('Por favor complete todos los campos correctamente', 'warning');
                return;
            }

            // Get existing inventory
            const storageKey = CONFIG.storagePrefix + 'inventory';
            const inventory = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            if (form.dataset.editing === 'true' && form.dataset.editId) {
                // Update existing item
                const editId = parseInt(form.dataset.editId);
                const index = inventory.findIndex(item => item.id === editId);
                
                if (index !== -1) {
                    data.id = editId;
                    data.createdAt = inventory[index].createdAt;
                    data.updatedAt = new Date().toISOString();
                    inventory[index] = data;
                    showNotification('Item actualizado exitosamente', 'success');
                }
            } else {
                // Add new item
                data.id = Date.now();
                data.createdAt = new Date().toISOString();
                inventory.push(data);
                showNotification('Item agregado exitosamente', 'success');
            }
            
            // Save updated inventory
            localStorage.setItem(storageKey, JSON.stringify(inventory));
            
            form.reset();
            form.dataset.editing = 'false';
            form.dataset.editId = '';
            
            // Close modal if exists
            const modal = bootstrap.Modal.getInstance(document.getElementById('addItemModal'));
            if(modal) {
                modal.hide();
            }
            
            updateInventoryDisplay();
        } else if (formId === 'deceasedForm') {
            data = {
                id: Date.now(),
                name: document.getElementById('deceasedName').value,
                documentId: document.getElementById('documentId').value,
                age: document.getElementById('deceasedAge').value,
                dateOfDeath: document.getElementById('dateOfDeath').value,
                causeOfDeath: document.getElementById('causeOfDeath').value,
                deathLocation: document.getElementById('deathLocation').value,
                familyContact: document.getElementById('familyContact').value,
                serviceType: document.getElementById('serviceType').value,
                status: document.getElementById('deceasedStatus').value,
                notes: document.getElementById('deceasedNotes').value,
                createdAt: new Date().toISOString(),
                createdBy: currentUser ? currentUser.username : 'system'
            };

            if (!data.name || !data.documentId || !data.dateOfDeath) {
                showNotification('Por favor complete los campos requeridos', 'warning');
                return;
            }

            const storageKey = CONFIG.storagePrefix + 'deceased';
            const deceased = JSON.parse(localStorage.getItem(storageKey) || '[]');
            deceased.push(data);
            localStorage.setItem(storageKey, JSON.stringify(deceased));

            showNotification('Registro guardado exitosamente', 'success');
            form.reset();
            
            // Close modal if exists
            const modal = bootstrap.Modal.getInstance(document.getElementById('addDeceasedModal'));
            if (modal) {
                modal.hide();
            }
            
            updateDeceasedDisplay();
        } else if (formId === 'salesForm') {
            // Handle sales form
            data = {
                id: Date.now(),
                clientId: document.getElementById('saleClient').value,
                status: document.getElementById('saleStatus').value,
                paymentMethod: document.getElementById('paymentMethod').value,
                items: currentSale.items,
                total: currentSale.total,
                notes: document.getElementById('saleNotes').value,
                date: new Date().toISOString(),
                createdBy: currentUser ? currentUser.username : 'system',
                onCredit: document.getElementById('onCredit').checked,
                paymentStatus: document.getElementById('onCredit').checked ? 'pendiente' : 'pagado',
                amountPaid: document.getElementById('onCredit').checked ? 0 : currentSale.total
            };
            
            const storageKey = CONFIG.storagePrefix + 'sales';
            const sales = JSON.parse(localStorage.getItem(storageKey) || '[]');
            sales.push(data);
            localStorage.setItem(storageKey, JSON.stringify(sales));
            updateSalesDisplay();
        } else {
            // Handle other forms
            const formData = new FormData(form);
            formData.forEach((value, key) => {
                data[key] = value;
            });
            data.id = Date.now();
            data.createdAt = new Date().toISOString();
            data.createdBy = currentUser ? currentUser.username : 'system';

            const storageKey = CONFIG.storagePrefix + getStorageKeyFromFormId(formId);
            const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
            items.push(data);
            localStorage.setItem(storageKey, JSON.stringify(items));
        }

        // Close modal if exists
        const modal = bootstrap.Modal.getInstance(form.closest('.modal'));
        if(modal) {
            modal.hide();
        }

    } catch(err) {
        console.error('Error submitting form:', err);
        showNotification('Error guardando datos', 'error');
    }
}

function getStorageKeyFromFormId(formId) {
  const mappings = {
    'inventoryForm': 'inventory',
    'salesForm': 'sales',
    'clientForm': 'clients',
    'deceasedForm': 'deceased',
    'expenseForm': 'expenses'
  };
  return mappings[formId];
}

function updateDisplay(formId) {
  switch(formId) {
    case 'inventoryForm':
      updateInventoryDisplay();
      break;
    case 'salesForm':
      updateSalesDisplay();
      break;
    case 'clientForm':
      updateClientsDisplay();
      break;
    case 'deceasedForm':
      updateDeceasedDisplay();
      break;
    case 'expenseForm':
      updateExpensesDisplay();
      break;
  }
  updateDashboard();
}

function showSection(sectionId) {
  // Check permissions
  if (currentUser && currentUser.role === 'cajero' && !USER_PERMISSIONS.cajero.canView.includes(sectionId)) {
    showNotification('No tiene permisos para acceder a esta sección', 'warning');
    return;
  }

  document.querySelectorAll('.section-content').forEach(section => {
    section.classList.add('d-none');
  });
  
  const targetSection = document.getElementById(sectionId + 'Section');
  if (targetSection) {
    targetSection.classList.remove('d-none');
  }
  
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    }
  });

  // Update displays based on permissions
  if (currentUser && currentUser.role === 'cajero') {
    // For cashiers, only show their own transactions
    if (sectionId === 'ventas' || sectionId === 'cuadre') {
      filterDataForCashier();
    }
  }
}

function filterDataForCashier() {
  if (!currentUser || currentUser.role !== 'cajero') return;

  // Filter sales
  const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
  const filteredSales = sales.filter(sale => sale.createdBy === currentUser.username);
  
  // Filter cash movements
  const movements = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'cashMovements') || '[]');
  const filteredMovements = movements.filter(movement => movement.createdBy === currentUser.username);

  // Update displays with filtered data
  updateSalesDisplay(filteredSales);
  updateCashSummary(filteredMovements);
}

function updateDashboard() {
  if (!currentUser) return;

  const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
  const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
  const cashMovements = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'cashMovements') || '[]');
  
  // Filter data for cashiers
  const filteredSales = currentUser.role === 'cajero' ? 
    sales.filter(sale => sale.createdBy === currentUser.username) : 
    sales;
  
  const filteredMovements = currentUser.role === 'cajero' ? 
    cashMovements.filter(movement => movement.createdBy === currentUser.username) : 
    cashMovements;

  // Update stats based on filtered data
  const today = new Date().toDateString();
  const todaySales = filteredSales.filter(sale => new Date(sale.date).toDateString() === today);
  
  document.getElementById('ventasHoy').textContent = todaySales.length;
  
  const todayIncome = todaySales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
  document.getElementById('totalIngresosHoy').textContent = formatCurrency(todayIncome);
  
  // Only show inventory stats for admin
  if (currentUser.role === 'admin') {
    document.getElementById('totalCajas').textContent = inventory.filter(item => item.type === 'caja').length;
    document.getElementById('totalSillas').textContent = inventory.filter(item => item.type === 'silla').length;
    document.getElementById('totalMesas').textContent = inventory.filter(item => item.type === 'mesa').length;
    document.getElementById('totalCarpas').textContent = inventory.filter(item => item.type === 'carpa').length;
    document.getElementById('totalItems').textContent = inventory.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  }
  
  // Update activity feed with filtered data
  updateRecentActivity(filteredMovements, filteredSales);
}

function updateRecentActivity(movements, sales) {
  const recentActivityContainer = document.getElementById('ultimosMovimientos');
  if (!recentActivityContainer) return;
  
  // Combine and sort by date
  const allActivities = [
    ...sales.map(sale => ({
      type: 'sale',
      date: sale.date,
      title: `Venta a ${sale.clientName || 'Cliente'}`,
      amount: sale.total,
      icon: 'cart'
    })),
    ...movements.map(movement => ({
      type: movement.type,
      date: movement.date,
      title: movement.description,
      amount: movement.amount,
      icon: movement.type === 'ingreso' ? 'cash' : 'cash-stack'
    }))
  ];
  
  // Sort by date (newest first)
  allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Take only the last 5 activities
  const recentActivities = allActivities.slice(0, 5);
  
  // Generate HTML
  const html = recentActivities.length > 0 ? 
    `<ul class="activity-list">
      ${recentActivities.map(activity => `
        <li class="activity-item">
          <div class="activity-icon">
            <i class="bi bi-${activity.icon}"></i>
          </div>
          <div class="activity-details">
            <div class="activity-title">${activity.title}</div>
            <div class="activity-meta">
              ${new Date(activity.date).toLocaleDateString()} - 
              ${activity.type === 'sale' || activity.type === 'ingreso' 
                ? `<span class="text-success">${formatCurrency(activity.amount)}</span>` 
                : `<span class="text-danger">-${formatCurrency(activity.amount)}</span>`}
            </div>
          </div>
        </li>
      `).join('')}
    </ul>` : 
    `<div class="p-3 text-center text-muted">No hay actividad reciente</div>`;
  
  recentActivityContainer.innerHTML = html;
}

function updateInventoryDisplay() {
    try {
        const inventoryList = document.getElementById('inventoryList');
        if (!inventoryList) return;

        const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
        
        if(inventory.length === 0) {
            inventoryList.innerHTML = '<div class="alert alert-info">No hay items en el inventario</div>';
            return;
        }

        const html = inventory.map(item => `
            <div class="inventory-item" data-id="${item.id || ''}" data-status="${item.status || 'disponible'}">
                <div class="row align-items-center p-3">
                    <div class="col-md-2">${item.type || 'N/A'}</div>
                    <div class="col-md-3">${item.name || 'N/A'}</div>
                    <div class="col-md-2">${item.quantity !== undefined ? item.quantity : '0'}</div>
                    <div class="col-md-2">$${item.price ? item.price.toFixed(2) : '0.00'}</div>
                    <div class="col-md-2">${item.status || 'N/A'}</div>
                    <div class="col-md-1">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-primary" onclick="editItem('inventory', ${item.id})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-danger" onclick="deleteItem('inventory', ${item.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        inventoryList.innerHTML = html;

    } catch(err) {
        console.error('Error updating inventory:', err);
        showNotification('Error actualizando inventario', 'error');
    }
}

function showNotification(message, type = 'info') {
  // Check if notifications are enabled in settings
  if (type !== 'error' && CONFIG.notifications && CONFIG.notifications.enabled === false) {
    return;
  }
  
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
  notification.style.zIndex = '9999';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Use the configured duration
  const duration = CONFIG.notifications.duration || 3000;
  setTimeout(() => notification.remove(), duration);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-DO').format(new Date(date));
}

// Update Sales Display
function updateSalesDisplay(sales = null) {
    try {
        const salesTableBody = document.getElementById('salesTableBody');
        if (!salesTableBody) return;

        const allSales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
        const filteredSales = sales || allSales;
        
        if (filteredSales.length === 0) {
            salesTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No hay ventas registradas</td></tr>';
            return;
        }

        // Sort sales by date (newest first)
        filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Filter out fully processed sales unless in report view
        const currentSection = document.querySelector('.section-content:not(.d-none)').id;
        const shownSales = (currentSection === 'reportesSection') ? 
            filteredSales : 
            filteredSales.filter(sale => !(sale.processed === true && sale.paymentStatus === 'pagado' && sale.status === 'completado'));

        salesTableBody.innerHTML = shownSales.map(sale => {
            // Get client name from storage
            const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
            const client = clients.find(c => c.id === parseInt(sale.clientId)) || { name: 'Cliente no encontrado' };
            
            // Format items list
            const itemsList = sale.items ? sale.items.map(item => item.name).join(', ') : 'No items';
            
            // Format date
            const saleDate = new Date(sale.date || new Date()).toLocaleDateString();

            // Credit status badge
            const creditBadge = sale.onCredit ? 
                '<span class="badge bg-warning me-1">Crédito</span>' : '';
            
            // Waiting status badge
            const waitingBadge = sale.status === 'espera' ? 
                '<span class="badge bg-info me-1">En Espera</span>' : '';
                
            // Payment status badge
            const paymentBadge = sale.paymentStatus === 'pagado' ? 
                '<span class="badge bg-success me-1">Pagado</span>' : 
                sale.paymentStatus === 'parcial' ? 
                '<span class="badge bg-primary me-1">Pago Parcial</span>' : 
                '<span class="badge bg-danger me-1">Pendiente</span>';

            return `
                <tr>
                    <td>${saleDate}</td>
                    <td>${client.name}</td>
                    <td>${itemsList}</td>
                    <td class="number">${formatCurrency(sale.total || 0)}</td>
                    <td>
                        ${creditBadge}
                        ${waitingBadge}
                        <span class="badge ${sale.status === 'completado' ? 'bg-success' : sale.status === 'espera' ? 'bg-info' : 'bg-warning'}">
                            ${sale.status || 'pendiente'}
                        </span>
                    </td>
                    <td>${paymentBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary me-1" onclick="viewSaleDetails(${sale.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSale(${sale.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch(err) {
        console.error('Error updating sales display:', err);
        showNotification('Error actualizando ventas', 'error');
    }
}

function viewSaleDetails(saleId) {
  const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
  const sale = sales.find(s => s.id === saleId);
  if (sale) {
    // Show sale details in modal
    const modal = new bootstrap.Modal(document.getElementById('saleDetailsModal'));
    document.getElementById('saleDetailClientName').textContent = getSaleClientName(sale.clientId);
    document.getElementById('saleDetailDate').textContent = new Date(sale.date).toLocaleDateString();
    document.getElementById('saleDetailTotal').textContent = formatCurrency(sale.total);
    document.getElementById('saleDetailStatus').textContent = sale.status;
    document.getElementById('saleDetailPaymentStatus').textContent = sale.paymentStatus || 'No registrado';
    document.getElementById('saleDetailAmountPaid').textContent = formatCurrency(sale.amountPaid || 0);
    document.getElementById('saleDetailAmountDue').textContent = formatCurrency(sale.total - (sale.amountPaid || 0));
    
    // Setup status editing options
    document.getElementById('editPaymentStatus').value = sale.paymentStatus || 'pendiente';
    document.getElementById('editSaleStatus').value = sale.status || 'pendiente';
    
    // Configure payment form
    const paymentForm = document.getElementById('paymentForm');
    paymentForm.dataset.saleId = saleId;
    document.getElementById('paymentAmount').max = sale.total - (sale.amountPaid || 0);
    document.getElementById('paymentAmount').value = sale.total - (sale.amountPaid || 0);
    
    modal.show();
  } else {
    showNotification('Venta no encontrada', 'error');
  }
}

function getSaleClientName(clientId) {
  const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
  const client = clients.find(c => c.id === parseInt(clientId));
  return client ? client.name : 'Cliente no encontrado';
}

function processPayment() {
  const paymentForm = document.getElementById('paymentForm');
  const saleId = parseInt(paymentForm.dataset.saleId);
  const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
  const paymentMethod = document.getElementById('paymentMethodDetails').value;
  
  if (!saleId || isNaN(paymentAmount) || paymentAmount <= 0) {
    showNotification('Datos de pago inválidos', 'warning');
    return;
  }
  
  const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
  const saleIndex = sales.findIndex(s => s.id === saleId);
  
  if (saleIndex === -1) {
    showNotification('Venta no encontrada', 'error');
    return;
  }
  
  const sale = sales[saleIndex];
  const amountDue = sale.total - (sale.amountPaid || 0);
  
  // Update sale with payment information
  sale.amountPaid = (sale.amountPaid || 0) + paymentAmount;
  
  // Update payment status
  if (sale.amountPaid >= sale.total) {
    sale.paymentStatus = 'pagado';
    sale.status = 'completado'; // Also mark as completed if it was in waiting or pending
  } else {
    sale.paymentStatus = 'parcial';
  }
  
  // Register payment in cash movements
  const cashMovement = {
    id: Date.now(),
    type: 'ingreso',
    amount: paymentAmount,
    description: `Pago ${sale.paymentStatus === 'pagado' ? 'completo' : 'parcial'} de venta ID: ${sale.id} - Cliente: ${getSaleClientName(sale.clientId)}`,
    date: new Date().toISOString(),
    createdBy: currentUser ? currentUser.username : 'system',
    saleId: sale.id,
    paymentMethod: paymentMethod
  };
  
  const cashMovements = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'cashMovements') || '[]');
  cashMovements.push(cashMovement);
  
  // Save updated data
  localStorage.setItem(CONFIG.storagePrefix + 'sales', JSON.stringify(sales));
  localStorage.setItem(CONFIG.storagePrefix + 'cashMovements', JSON.stringify(cashMovements));
  
  // Close modal and update UI
  const modal = bootstrap.Modal.getInstance(document.getElementById('saleDetailsModal'));
  if (modal) {
    modal.hide();
  }
  
  updateSalesDisplay();
  updateCashSummary();
  updateDashboard();
  
  showNotification('Pago procesado exitosamente', 'success');
}

function deleteSale(saleId) {
  // Check if user is admin
  if (currentUser && currentUser.role !== 'admin') {
    showNotification('Solo el administrador puede eliminar ventas', 'warning');
    return;
  }
  
  if (confirm('¿Está seguro de eliminar esta venta?')) {
    const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
    const saleIndex = sales.findIndex(s => s.id === saleId);
    
    if (saleIndex !== -1) {
      const deletedSale = sales[saleIndex];
      
      // Restore inventory quantities
      if (deletedSale.items && deletedSale.items.length > 0) {
        const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
        
        deletedSale.items.forEach(item => {
          // Try to find by inventoryItemId first
          if (item.inventoryItemId) {
            const inventoryIndex = inventory.findIndex(invItem => invItem.id === item.inventoryItemId);
            if (inventoryIndex !== -1) {
              inventory[inventoryIndex].quantity += item.quantity;
            }
          } else {
            // Try by name
            const inventoryIndex = inventory.findIndex(invItem => 
              invItem.name.toLowerCase() === item.name.toLowerCase());
            if (inventoryIndex !== -1) {
              inventory[inventoryIndex].quantity += item.quantity;
            }
          }
        });
        
        localStorage.setItem(CONFIG.storagePrefix + 'inventory', JSON.stringify(inventory));
        updateInventoryDisplay();
      }
      
      // Remove the sale
      sales.splice(saleIndex, 1);
      localStorage.setItem(CONFIG.storagePrefix + 'sales', JSON.stringify(sales));
      updateSalesDisplay();
      updateDashboard();
      showNotification('Venta eliminada exitosamente', 'success');
    }
  }
}

// Update Clients Display
function updateClientsDisplay() {
  const clientsList = document.getElementById('clientsList');
  if (!clientsList) return;

  const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
  
  if (clients.length === 0) {
    clientsList.innerHTML = '<div class="alert alert-info">No hay clientes registrados</div>';
    return;
  }

  // Create table structure
  let html = `
    <table class="table table-hover">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Cédula/RNC</th>
          <th>Teléfono</th> 
          <th>Dirección</th>
          <th>Email</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Add each client as a row
  html += clients.map(client => `
    <tr>
      <td>${client.name || '-'}</td>
      <td>${client.documentId || '-'}</td>
      <td>${client.phone || '-'}</td>
      <td>${client.address || '-'}</td>
      <td>${client.email || '-'}</td>
      <td>
        <button class="btn btn-sm btn-primary me-1" onclick="editItem('clients', ${client.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('clients', ${client.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  html += `
      </tbody>
    </table>
  `;
  
  clientsList.innerHTML = html;

  // Update client select in sales form
  const clientSelect = document.getElementById('saleClient');
  if (clientSelect) {
    clientSelect.innerHTML = '<option value="">Seleccionar cliente...</option>';
    clients.forEach(client => {
      clientSelect.add(new Option(client.name, client.id));
    });
  }
}

// Update Deceased Display
function updateDeceasedDisplay() {
  const deceasedList = document.getElementById('deceasedList');
  if (!deceasedList) return;

  const deceased = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'deceased') || '[]');
  
  if (deceased.length === 0) {
    deceasedList.innerHTML = '<div class="alert alert-info">No hay registros de fallecidos</div>';
    return;
  }

  let html = `
    <table class="table table-hover">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Documento</th>
          <th>Fecha</th>
          <th>Causa</th>
          <th>Servicio</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
  `;

  html += deceased.map(person => `
    <tr>
      <td>${person.name || '-'}</td>
      <td>${person.documentId || '-'}</td>
      <td>${new Date(person.dateOfDeath).toLocaleDateString('es-ES')}</td>
      <td>${person.causeOfDeath || '-'}</td>
      <td>${person.serviceType || '-'}</td>
      <td>
        <span class="badge ${getBadgeClass(person.status)}">
          ${getStatusText(person.status)}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary me-1" onclick="editItem('deceased', ${person.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('deceased', ${person.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  html += `
      </tbody>
    </table>
  `;
  
  deceasedList.innerHTML = html;

  const headerDiv = document.querySelector('#fallecidosSection .d-flex');
  if (headerDiv) {
    // Check if print button already exists
    if (!headerDiv.querySelector('.print-button')) {
      const printButton = document.createElement('button');
      printButton.className = 'btn btn-secondary ms-2 print-button';
      printButton.innerHTML = '<i class="bi bi-printer"></i> Imprimir Registros';
      printButton.onclick = printDeceasedRecords;
      headerDiv.appendChild(printButton);
    }
  }
}

function getBadgeClass(status) {
  switch(status) {
    case 'completado': return 'bg-success';
    case 'en_proceso': return 'bg-warning';
    case 'pendiente': return 'bg-danger';
    default: return 'bg-secondary';
  }
}

function getStatusText(status) {
  switch(status) {
    case 'completado': return 'Completado';
    case 'en_proceso': return 'En Proceso';
    case 'pendiente': return 'Pendiente';
    default: return status;
  }
}

// Update Expenses Display
function updateExpensesDisplay() {
  const expensesList = document.getElementById('expensesList');
  if (!expensesList) return;

  const expenses = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'expenses') || '[]');
  const html = expenses.map(expense => `
    <div class="expense-item" data-id="${expense.id}">
      <div class="row align-items-center">
        <div class="col-md-3">${expense.date}</div>
        <div class="col-md-2">${expense.amount}</div>
        <div class="col-md-2">${expense.description}</div>
        <div class="col-md-3">
          <button class="btn btn-sm btn-primary me-1" onclick="editItem('expenses', ${expense.id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem('expenses', ${expense.id})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
  
  expensesList.innerHTML = html;
}

// Delete Item
function deleteItem(type, id) {
  // Check if user is admin
  if (currentUser && currentUser.role !== 'admin') {
    showNotification('Solo el administrador puede eliminar elementos', 'warning');
    return;
  }
  
  if (confirm('¿Está seguro de eliminar este item?')) {
    const storageKey = CONFIG.storagePrefix + type;
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items.splice(index, 1);
      localStorage.setItem(storageKey, JSON.stringify(items));
      
      if (type === 'inventory') {
        updateInventoryDisplay();
      } else if (type === 'clients') {
        updateClientsDisplay();
      } else if (type === 'deceased') {
        updateDeceasedDisplay();
      } else {
        updateDisplay(type + 'Form');
      }
      
      showNotification('Item eliminado exitosamente', 'success');
    }
  }
}

// Edit Item
function editItem(type, id) {
  // Check if user is admin
  if (currentUser && currentUser.role !== 'admin') {
    showNotification('Solo el administrador puede editar elementos', 'warning');
    return;
  }

  const storageKey = CONFIG.storagePrefix + type;
  const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const item = items.find(item => item.id === id);
  
  if (!item) {
    showNotification('Item no encontrado', 'error');
    return;
  }
  
  if (type === 'clients') {
    // Open client edit modal
    const modal = new bootstrap.Modal(document.getElementById('addClientModal'));
    
    // Fill form with client data
    document.getElementById('clientName').value = item.name || '';
    document.getElementById('clientId').value = item.documentId || '';
    document.getElementById('clientPhone').value = item.phone || '';
    document.getElementById('clientAddress').value = item.address || '';
    document.getElementById('clientEmail').value = item.email || '';
    
    // Set form ID attribute for the update
    const form = document.getElementById('clientForm');
    form.dataset.editing = 'true';
    form.dataset.editId = id;
    
    modal.show();
  } else if (type === 'inventory') {
    // Open inventory edit modal
    const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
    
    // Fill form with inventory data
    if (document.getElementById('itemType')) document.getElementById('itemType').value = item.type || 'caja';
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemQuantity').value = item.quantity || 0;
    document.getElementById('itemPrice').value = item.price || 0;
    document.getElementById('itemStatus').value = item.status || 'disponible';
    
    // Set form as editing
    const form = document.getElementById('inventoryForm');
    form.dataset.editing = 'true';
    form.dataset.editId = id;
    
    modal.show();
  } else if (type === 'deceased') {
    // Open deceased edit modal
    const modal = new bootstrap.Modal(document.getElementById('addDeceasedModal'));
    
    // Fill form with deceased data
    document.getElementById('deceasedName').value = item.name || '';
    document.getElementById('documentId').value = item.documentId || '';
    document.getElementById('deceasedAge').value = item.age || '';
    document.getElementById('dateOfDeath').value = item.dateOfDeath || '';
    document.getElementById('causeOfDeath').value = item.causeOfDeath || '';
    document.getElementById('deathLocation').value = item.deathLocation || '';
    document.getElementById('familyContact').value = item.familyContact || '';
    document.getElementById('serviceType').value = item.serviceType || 'basico';
    document.getElementById('deceasedStatus').value = item.status || 'pendiente';
    document.getElementById('deceasedNotes').value = item.notes || '';
    
    // Set form as editing
    const form = document.getElementById('deceasedForm');
    form.dataset.editing = 'true';
    form.dataset.editId = id;
    
    modal.show();
  } else {
    // Handle other item types (existing implementation)
    const editForm = document.getElementById('editForm');
    if (editForm) {
      editForm.querySelector('input[name="name"]').value = item.name;
      editForm.querySelector('input[name="quantity"]').value = item.quantity;
      editForm.querySelector('input[name="price"]').value = item.price;
      editForm.querySelector('select[name="status"]').value = item.status;
      editForm.dataset.type = type;
      editForm.dataset.id = id;
      showSection('edit');
    }
  }
}

function addManualItem() {
    try {
        const name = document.getElementById('itemNameInput').value;
        const quantity = parseInt(document.getElementById('itemQuantityInput').value) || 1;
        
        if (!name) {
            showNotification('Ingrese el nombre del item', 'warning');
            return;
        }

        // Check if item exists in inventory
        const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
        const inventoryItem = inventory.find(item => item.name.toLowerCase() === name.toLowerCase());
        
        if (!inventoryItem) {
            showNotification('Este item no existe en el inventario', 'warning');
            return;
        }
        
        // Check if there's enough stock
        if (inventoryItem.quantity < quantity) {
            showNotification(`Solo hay ${inventoryItem.quantity} unidades disponibles`, 'warning');
            return;
        }

        const price = parseFloat(inventoryItem.price) || 0;
        
        if (price <= 0) {
            showNotification('El item tiene un precio inválido', 'warning');
            return;
        }

        const item = {
            id: Date.now(),
            name,
            quantity,
            price,
            subtotal: quantity * price,
            inventoryItemId: inventoryItem.id // Store reference to inventory item
        };

        currentSale.items.push(item);
        updateSaleItemsList();
        updateSaleTotal();

        // Clear inputs
        document.getElementById('itemNameInput').value = '';
        document.getElementById('itemQuantityInput').value = '1';

        // Show remaining stock notification
        const remainingStock = inventoryItem.quantity - quantity;
        showNotification(`Quedan ${remainingStock} unidades disponibles`, 'info');

    } catch(err) {
        console.error('Error adding item:', err);
        showNotification('Error agregando item', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const salesForm = document.getElementById('salesForm');
    if (salesForm) {
        // Remove any existing event listeners first
        const newSalesForm = salesForm.cloneNode(true);
        salesForm.parentNode.replaceChild(newSalesForm, salesForm);
        
        newSalesForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Disable submit button to prevent double submission
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }
            
            try {
                // Validate inventory quantities before proceeding
                const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
                let insufficientStock = false;
                
                currentSale.items.forEach(saleItem => {
                    const inventoryItem = inventory.find(item => 
                        item.id === saleItem.inventoryItemId || 
                        item.name.toLowerCase() === saleItem.name.toLowerCase()
                    );
                    
                    if (!inventoryItem || inventoryItem.quantity < saleItem.quantity) {
                        insufficientStock = true;
                        showNotification(`Stock insuficiente para ${saleItem.name}`, 'warning');
                    }
                });
                
                if (insufficientStock) {
                    submitButton.disabled = false;
                    return;
                }

                // Proceed with sale
                const saleData = {
                    id: Date.now(),
                    clientId: document.getElementById('saleClient').value,
                    status: document.getElementById('saleStatus').value,
                    paymentMethod: document.getElementById('paymentMethod').value,
                    items: currentSale.items,
                    total: currentSale.total,
                    notes: document.getElementById('saleNotes').value,
                    date: new Date().toISOString(),
                    createdBy: currentUser ? currentUser.username : 'system',
                    onCredit: document.getElementById('onCredit').checked,
                    paymentStatus: document.getElementById('onCredit').checked ? 'pendiente' : 'pagado',
                    amountPaid: document.getElementById('onCredit').checked ? 0 : currentSale.total
                };

                // Update inventory quantities
                currentSale.items.forEach(saleItem => {
                    const inventoryIndex = inventory.findIndex(item => 
                        item.id === saleItem.inventoryItemId || 
                        item.name.toLowerCase() === saleItem.name.toLowerCase()
                    );
                    
                    if (inventoryIndex !== -1) {
                        // Decrement quantity
                        inventory[inventoryIndex].quantity -= saleItem.quantity;
                        
                        // Ensure quantity doesn't go below 0
                        if (inventory[inventoryIndex].quantity < 0) {
                            inventory[inventoryIndex].quantity = 0;
                        }
                        
                        // Show low stock warning if applicable
                        if (inventory[inventoryIndex].quantity <= 5) {
                            showNotification(`Stock bajo para ${inventory[inventoryIndex].name}: ${inventory[inventoryIndex].quantity} unidades`, 'warning');
                        }
                    }
                });

                // Save updated inventory
                localStorage.setItem(CONFIG.storagePrefix + 'inventory', JSON.stringify(inventory));

                // Save sale
                const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
                sales.push(saleData);
                localStorage.setItem(CONFIG.storagePrefix + 'sales', JSON.stringify(sales));

                // Reset current sale
                currentSale = {
                    items: [],
                    total: 0
                };

                // Update displays
                updateInventoryDisplay();
                updateSalesDisplay();
                updateDashboard();

                // Show success message
                showNotification('Venta registrada exitosamente', 'success');

                // Close modal if exists
                const modal = bootstrap.Modal.getInstance(document.getElementById('addSaleModal'));
                if (modal) {
                    modal.hide();
                }

                // Reset form
                newSalesForm.reset();
                document.getElementById('saleItemsList').innerHTML = '';
                document.getElementById('saleTotal').textContent = '0.00';

            } catch(err) {
                console.error('Error registering sale:', err);
                showNotification('Error al registrar la venta', 'error');
            } finally {
                // Re-enable submit button
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }
});

// Update sale items list
function updateSaleItemsList() {
  const itemsList = document.getElementById('saleItemsList');
  if (!itemsList) return;

  itemsList.innerHTML = currentSale.items.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="number">${formatCurrency(item.price)}</td>
      <td class="number">${formatCurrency(item.subtotal)}</td>
      <td>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeItem(${index})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Update sale total
function updateSaleTotal() {
  const total = currentSale.items.reduce((sum, item) => sum + item.subtotal, 0);
  currentSale.total = total;
  document.getElementById('saleTotal').textContent = total.toFixed(2);
}

function removeItem(index) {
  currentSale.items.splice(index, 1);
  updateSaleItemsList();
  updateSaleTotal();
}

function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const reportType = document.getElementById('reportType').value;
    
    if (!startDate || !endDate) {
        showNotification('Seleccione fechas para generar el reporte', 'warning');
        return;
    }
    
    // Content container
    const reportContent = document.getElementById('reportContent');
    
    switch(reportType) {
        case 'ventas':
            generateSalesReport(startDate, endDate, reportContent);
            break;
        case 'clientes':
            generateClientReport(startDate, endDate, reportContent);
            break;
        case 'cuadre':
            generateCashReport(startDate, endDate, reportContent); 
            break;
        case 'diario':
            generateDailyActivityReport(startDate, endDate, reportContent);
            break;
        case 'nomina':  
            generatePayrollReport(startDate, endDate, reportContent);
            break;
        default:
            generateSalesReport(startDate, endDate, reportContent);
    }
}

function generateSalesReport(startDate, endDate, container) {
    const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
    
    // Filter sales by date range
    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= new Date(startDate) && saleDate <= new Date(endDate);
    });
    
    // Calculate totals
    const totalAmount = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
    const totalCredit = filteredSales.filter(sale => sale.onCredit).reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
    const completedSales = filteredSales.filter(sale => sale.status === 'completado').length;
    const pendingSales = filteredSales.filter(sale => sale.status === 'pendiente').length;
    const waitingSales = filteredSales.filter(sale => sale.status === 'espera').length;
    
    // Generate HTML
    const html = `
        <div class="alert alert-info mb-4">
            <strong>Reporte de ventas desde ${formatDate(startDate)} hasta ${formatDate(endDate)}</strong>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total Ventas</h5>
                        <h3>${filteredSales.length}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Monto Total</h5>
                        <h3>${formatCurrency(totalAmount)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total a Crédito</h5>
                        <h3>${formatCurrency(totalCredit)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Estado</h5>
                        <p class="mb-1">Completadas: ${completedSales}</p>
                        <p class="mb-1">Pendientes: ${pendingSales}</p>
                        <p class="mb-0">En Espera: ${waitingSales}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Productos</th>
                        <th>Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredSales.map(sale => {
                        const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
                        const client = clients.find(c => c.id === parseInt(sale.clientId)) || { name: 'Cliente no encontrado' };
                        
                        const itemsList = sale.items ? sale.items.map(item => item.name).join(', ') : 'No items';
                        
                        const creditBadge = sale.onCredit ? 
                            '<span class="badge bg-warning me-1">Crédito</span>' : '';
                        
                        const waitingBadge = sale.status === 'espera' ? 
                            '<span class="badge bg-info me-1">En Espera</span>' : '';
                            
                        return `
                            <tr>
                                <td>${new Date(sale.date).toLocaleDateString()}</td>
                                <td>${client.name}</td>
                                <td>${itemsList}</td>
                                <td class="number">${formatCurrency(sale.total || 0)}</td>
                                <td>
                                    ${creditBadge}
                                    ${waitingBadge}
                                    <span class="badge ${sale.status === 'completado' ? 'bg-success' : sale.status === 'espera' ? 'bg-info' : 'bg-warning'}">
                                        ${sale.status || 'pendiente'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="mt-4 text-end">
            <button class="btn btn-primary" onclick="printReport()">
                <i class="bi bi-printer"></i> Imprimir Reporte
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function generateClientReport(startDate, endDate, container) {
    const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
    
    // Filter clients by date
    const filteredClients = clients.filter(client => {
        const clientDate = new Date(client.createdAt);
        return clientDate >= new Date(startDate) && clientDate <= new Date(endDate);
    });
    
    // Get sales data to calculate client metrics
    const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
    
    // Calculate client analytics
    const clientAnalytics = filteredClients.map(client => {
        const clientSales = sales.filter(sale => parseInt(sale.clientId) === client.id);
        const totalSpent = clientSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
        const purchaseCount = clientSales.length;
        
        return {
            ...client,
            totalSpent,
            purchaseCount
        };
    });
    
    // Sort by total spent (highest first)
    clientAnalytics.sort((a, b) => b.totalSpent - a.totalSpent);
    
    const html = `
        <div class="alert alert-info mb-4">
            <strong>Reporte de clientes desde ${formatDate(startDate)} hasta ${formatDate(endDate)}</strong>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total Clientes</h5>
                        <h3>${filteredClients.length}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Clientes Activos</h5>
                        <h3>${clientAnalytics.filter(c => c.purchaseCount > 0).length}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Cliente con Mayor Compra</h5>
                        <h3>${clientAnalytics.length > 0 ? clientAnalytics[0].name : 'N/A'}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Identificación</th>
                        <th>Teléfono</th> 
                        <th>Fecha Registro</th>
                        <th>Compras</th>
                        <th>Total Gastado</th>
                    </tr>
                </thead>
                <tbody>
                    ${clientAnalytics.map(client => `
                        <tr>
                            <td>${client.name}</td>
                            <td>${client.documentId || 'N/A'}</td>
                            <td>${client.phone || 'N/A'}</td>
                            <td>${formatDate(client.createdAt)}</td>
                            <td>${client.purchaseCount}</td>
                            <td>${formatCurrency(client.totalSpent)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="mt-4 text-end">
            <button class="btn btn-primary" onclick="printReport()">
                <i class="bi bi-printer"></i> Imprimir Reporte
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function generateCashReport(startDate, endDate, container) {
    const cashMovements = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'cashMovements') || '[]');
    
    // Filter by date range
    const filteredMovements = cashMovements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate >= new Date(startDate) && movementDate <= new Date(endDate);
    });
    
    // Calculate totals
    const income = filteredMovements.filter(m => m.type === 'ingreso')
        .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    
    const expenses = filteredMovements.filter(m => m.type === 'egreso')
        .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    
    const balance = income - expenses;
    
    // Group by day
    const movementsByDay = {};
    
    filteredMovements.forEach(movement => {
        const date = new Date(movement.date).toLocaleDateString();
        if (!movementsByDay[date]) {
            movementsByDay[date] = {
                date: date,
                income: 0,
                expenses: 0
            };
        }
        
        if (movement.type === 'ingreso') {
            movementsByDay[date].income += parseFloat(movement.amount) || 0;
        } else {
            movementsByDay[date].expenses += parseFloat(movement.amount) || 0;
        }
    });
    
    const dailySummary = Object.values(movementsByDay);
    
    // Sort by date (newest first)
    dailySummary.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const html = `
        <div class="alert alert-info mb-4">
            <strong>Reporte de cuadre de caja desde ${formatDate(startDate)} hasta ${formatDate(endDate)}</strong>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-4">
                <div class="card ${balance >= 0 ? 'bg-success' : 'bg-danger'} text-white">
                    <div class="card-body text-center">
                        <h5>Balance</h5>
                        <h3>${formatCurrency(balance)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h5>Ingresos</h5>
                        <h3>${formatCurrency(income)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card bg-warning text-dark">
                    <div class="card-body text-center">
                        <h5>Egresos</h5>
                        <h3>${formatCurrency(expenses)}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <h4 class="mb-3">Resumen Diario</h4>
        <div class="table-responsive mb-4">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Ingresos</th>
                        <th>Egresos</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailySummary.map(day => `
                        <tr>
                            <td>${day.date}</td>
                            <td class="text-success">${formatCurrency(day.income)}</td>
                            <td class="text-danger">${formatCurrency(day.expenses)}</td>
                            <td class="${day.income - day.expenses >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(day.income - day.expenses)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <h4 class="mb-3">Detalle de Movimientos</h4>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Monto</th>
                        <th>Registrado por</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredMovements.map(movement => `
                        <tr>
                            <td>${new Date(movement.date).toLocaleDateString()}</td>
                            <td>
                                <span class="badge ${movement.type === 'ingreso' ? 'bg-success' : 'bg-danger'}">
                                    ${movement.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                                </span>
                            </td>
                            <td>${movement.description}</td>
                            <td class="${movement.type === 'ingreso' ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(movement.amount)}
                            </td>
                            <td>${movement.createdBy}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="mt-4 text-end">
            <button class="btn btn-primary" onclick="printReport()">
                <i class="bi bi-printer"></i> Imprimir Reporte
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function generateDailyActivityReport(startDate, endDate, container) {
    // Get data from different sources
    const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
    const cashMovements = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'cashMovements') || '[]');
    const clients = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'clients') || '[]');
    const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
    const deceased = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'deceased') || '[]');
    
    // Define date range
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999); // Include the entire end day
    
    // Filter data by date range
    const filteredSales = sales.filter(sale => {
        const saleDate = new Date(sale.date);
        return saleDate >= startDateTime && saleDate <= endDateTime;
    });
    
    const filteredCashMovements = cashMovements.filter(movement => {
        const movementDate = new Date(movement.date);
        return movementDate >= startDateTime && movementDate <= endDateTime;
    });
    
    const filteredClients = clients.filter(client => {
        if (!client.createdAt) return false;
        const clientDate = new Date(client.createdAt);
        return clientDate >= startDateTime && clientDate <= endDateTime;
    });
    
    const filteredDeceased = deceased.filter(record => {
        if (!record.createdAt) return false;
        const recordDate = new Date(record.createdAt);
        return recordDate >= startDateTime && recordDate <= endDateTime;
    });
    
    // Calculate summary metrics
    const totalSales = filteredSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
    const totalIncome = filteredCashMovements.filter(m => m.type === 'ingreso')
        .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    const totalExpenses = filteredCashMovements.filter(m => m.type === 'egreso')
        .reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    
    // Combine all activities for chronological display
    const allActivities = [
        ...filteredSales.map(sale => ({
            type: 'sale',
            date: sale.date,
            title: `Venta a ${sale.clientName || 'Cliente'}`,
            description: `${sale.items ? sale.items.length : 0} items - ${formatCurrency(sale.total)}`,
            amount: sale.total,
            user: sale.createdBy
        })),
        ...filteredCashMovements.map(movement => ({
            type: movement.type,
            date: movement.date,
            title: movement.type === 'ingreso' ? 'Ingreso' : 'Egreso',
            description: movement.description,
            amount: movement.amount,
            user: movement.createdBy
        })),
        ...filteredClients.map(client => ({
            type: 'client',
            date: client.createdAt,
            title: 'Nuevo Cliente',
            description: client.name,
            user: client.createdBy
        })),
        ...filteredDeceased.map(record => ({
            type: 'deceased',
            date: record.createdAt,
            title: 'Registro de Fallecido',
            description: record.name,
            user: record.createdBy
        }))
    ];
    
    // Sort all activities chronologically (newest first)
    allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Group activities by day
    const activitiesByDay = {};
    
    allActivities.forEach(activity => {
        const date = new Date(activity.date).toLocaleDateString();
        if (!activitiesByDay[date]) {
            activitiesByDay[date] = [];
        }
        
        activitiesByDay[date].push(activity);
    });
    
    // Get dates and sort (newest first)
    const dates = Object.keys(activitiesByDay).sort((a, b) => new Date(b) - new Date(a));
    
    // Generate HTML
    let html = `
        <div class="alert alert-info mb-4">
            <strong>Reporte de actividad diaria desde ${formatDate(startDate)} hasta ${formatDate(endDate)}</strong>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total Ventas</h5>
                        <h3>${formatCurrency(totalSales)}</h3>
                        <small>${filteredSales.length} transacciones</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Ingresos</h5>
                        <h3>${formatCurrency(totalIncome)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Egresos</h5>
                        <h3>${formatCurrency(totalExpenses)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Clientes Nuevos</h5>
                        <h3>${filteredClients.length}</h3>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Generate content for each day
    html += dates.map(date => {
        const activities = activitiesByDay[date];
        
        return `
            <div class="card mb-4">
                <div class="card-header">
                    <h4>${new Date(date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}</h4>
                </div>
                <div class="card-body">
                    <ul class="activity-list" style="list-style: none; padding-left: 0;">
                        ${activities.map(activity => `
                            <li class="activity-item mb-3 pb-2 border-bottom">
                                <div class="d-flex align-items-center">
                                    <div class="activity-icon me-3">
                                        <i class="bi bi-${
                                            activity.type === 'sale' ? 'cart' : 
                                            activity.type === 'income' ? 'cash' : 
                                            activity.type === 'expense' ? 'cash-stack' :
                                            activity.type === 'client' ? 'person-plus' : 'person-x'
                                        } fs-4 ${
                                            activity.type === 'sale' || activity.type === 'income' ? 'text-success' : 
                                            activity.type === 'expense' ? 'text-danger' : 
                                            activity.type === 'client' ? 'text-primary' : 'text-secondary'
                                        }"></i>
                                    </div>
                                    <div class="activity-details flex-grow-1">
                                        <div class="d-flex justify-content-between">
                                            <strong>${activity.title}</strong>
                                            <small>${new Date(activity.date).toLocaleTimeString()}</small>
                                        </div>
                                        <div>${activity.description || ''}</div>
                                        <div class="text-muted small">Usuario: ${activity.user || 'Sistema'}</div>
                                    </div>
                                    ${activity.amount ? `
                                        <div class="activity-amount ms-3">
                                            <span class="${activity.type === 'sale' || activity.type === 'income' ? 'text-success' : 'text-danger'}">
                                                ${formatCurrency(activity.amount)}
                                            </span>
                                        </div>
                                    ` : ''}
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }).join('');
    
    html += `
        <div class="mt-4 text-end">
            <button class="btn btn-primary" onclick="printReport()">
                <i class="bi bi-printer"></i> Imprimir Reporte
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function printReport() {
    window.print();
}

// System configuration functions
function changeTheme(theme) {
  const root = document.documentElement;
  const body = document.body;
  
  // Remove existing theme classes
  body.classList.remove('dark-mode');
  
  if (theme === 'dark') {
    body.classList.add('dark-mode');
    root.style.setProperty('--primary-color', '#1a237e');
    root.style.setProperty('--secondary-color', '#0d47a1');
    root.style.setProperty('--text-color', '#ffffff');
    root.style.setProperty('--light-gray', '#37474f');
    root.style.setProperty('--light-blue', '#263238');
  } else if (theme === 'light') {
    root.style.setProperty('--primary-color', '#2c3e50');
    root.style.setProperty('--secondary-color', '#34495e');
    root.style.setProperty('--text-color', '#2c3e50');
    root.style.setProperty('--light-gray', '#f5f5f5');
    root.style.setProperty('--light-blue', '#ebf5fb');
  }
  
  // Save theme preference
  localStorage.setItem('theme', theme);
  
  // Update form controls in settings
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = theme;
  }
  
  // Update color inputs if they exist
  const primaryColor = document.getElementById('primaryColor');
  const secondaryColor = document.getElementById('secondaryColor');
  if (primaryColor && secondaryColor) {
    primaryColor.value = getComputedStyle(root).getPropertyValue('--primary-color').trim();
    secondaryColor.value = getComputedStyle(root).getPropertyValue('--secondary-color').trim();
  }
}

function updateColors(type, value) {
  const root = document.documentElement;
  
  if (type === 'primary') {
    root.style.setProperty('--primary-color', value);
    document.getElementById('themeSelect').value = 'custom';
  } else if (type === 'secondary') {
    root.style.setProperty('--secondary-color', value);
    document.getElementById('themeSelect').value = 'custom';
  }
  
  // Save color preferences
  localStorage.setItem(`color_${type}`, value);
}

function toggleNotifications(enabled) {
  CONFIG.notifications.enabled = enabled;
  localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
}

function exportData() {
  try {
    const exportData = {};
    
    // Export all data from localStorage with proper error handling
    Object.keys(CONFIG.storageKeys).forEach(key => {
      try {
        const storageKey = CONFIG.storagePrefix + CONFIG.storageKeys[key];
        exportData[key] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (err) {
        console.error(`Error exporting ${key}:`, err);
        showNotification(`Error exportando datos de ${key}`, 'error');
      }
    });
    
    // Add metadata to export
    exportData.metadata = {
      exportDate: new Date().toISOString(),
      systemVersion: '1.0',
      exportedBy: currentUser ? currentUser.username : 'system'
    };

    // Create file name with timestamp
    const timestamp = new Date().toISOString().split('.')[0].replace(/[:]/g, '-');
    const exportFileDefaultName = `respaldo_sistema_${timestamp}.json`;
    
    // Create and trigger download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    
    showNotification('Datos exportados exitosamente', 'success');
    
    // Log successful export
    logSystemActivity('data_export', 'Exportación de datos completada');
  } catch(err) {
    console.error('Error exporting data:', err);
    showNotification('Error al exportar datos', 'error');
  }
}

function handleImport(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate data structure and version
      if (!importedData || typeof importedData !== 'object') {
        throw new Error('Formato de archivo inválido');
      }
      
      // Verify required data sections
      const requiredSections = ['inventory', 'sales', 'clients', 'cashMovements'];
      const missingSections = requiredSections.filter(section => !importedData[section]);
      
      if (missingSections.length > 0) {
        throw new Error(`Faltan secciones requeridas: ${missingSections.join(', ')}`);
      }
      
      // Show confirmation with data summary
      const summary = {
        inventory: importedData.inventory?.length || 0,
        sales: importedData.sales?.length || 0,
        clients: importedData.clients?.length || 0,
        movements: importedData.cashMovements?.length || 0
      };
      
      const confirmMessage = `
        ¿Está seguro de importar estos datos? 
        Los datos actuales serán reemplazados.
        
        Resumen de datos a importar:
        - Inventario: ${summary.inventory} items
        - Ventas: ${summary.sales} registros
        - Clientes: ${summary.clients} registros
        - Movimientos: ${summary.movements} registros
      `;
      
      if (confirm(confirmMessage)) {
        // Create backup before import
        const backup = {};
        Object.keys(CONFIG.storageKeys).forEach(key => {
          const storageKey = CONFIG.storagePrefix + CONFIG.storageKeys[key];
          backup[key] = localStorage.getItem(storageKey);
        });
        
        try {
          // Import all data to localStorage
          Object.keys(importedData).forEach(key => {
            if (CONFIG.storageKeys[key]) {
              const storageKey = CONFIG.storagePrefix + CONFIG.storageKeys[key];
              localStorage.setItem(storageKey, JSON.stringify(importedData[key]));
            }
          });
          
          showNotification('Datos importados exitosamente. Recargando página...', 'success');
          
          // Log successful import
          logSystemActivity('data_import', 'Importación de datos completada');
          
          // Reload page after 2 seconds
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          
        } catch (importError) {
          // Restore backup if import fails
          Object.keys(backup).forEach(key => {
            const storageKey = CONFIG.storagePrefix + CONFIG.storageKeys[key];
            localStorage.setItem(storageKey, backup[key]);
          });
          
          throw new Error('Error durante la importación. Se restauró la copia de seguridad.');
        }
      }
    } catch(err) {
      console.error('Error importing data:', err);
      showNotification('Error al importar datos: ' + err.message, 'error');
    }
  };
  
  reader.readAsText(file);
}

function clearAllData() {
  // Check if user is admin
  if (!currentUser || currentUser.role !== 'admin') {
    showNotification('Solo el administrador puede limpiar todos los datos', 'warning');
    return;
  }
  
  const confirmMessage = `
    ¿Está ABSOLUTAMENTE SEGURO de eliminar todos los datos?
    Esta acción no se puede deshacer.
    
    Por favor escriba CONFIRMAR para proceder.
  `;
  
  const userInput = prompt(confirmMessage);
  
  if (userInput === 'CONFIRMAR') {
    try {
      // Create backup before clearing
      const backup = {};
      Object.keys(CONFIG.storageKeys).forEach(key => {
        const storageKey = CONFIG.storagePrefix + CONFIG.storageKeys[key];
        backup[key] = localStorage.getItem(storageKey);
      });
      
      // Clear all data
      Object.values(CONFIG.storageKeys).forEach(key => {
        localStorage.setItem(CONFIG.storagePrefix + key, JSON.stringify([]));
      });
      
      // Log the action
      logSystemActivity('data_clear', 'Limpieza total de datos realizada');
      
      showNotification('Todos los datos han sido eliminados', 'success');
      
      // Update all displays
      updateDashboard();
      updateInventoryDisplay();
      updateSalesDisplay();
      updateClientsDisplay();
      updateDeceasedDisplay();
      
      // Create recovery point
      localStorage.setItem('lastClearBackup', JSON.stringify({
        date: new Date().toISOString(),
        data: backup
      }));
      
    } catch(err) {
      console.error('Error clearing data:', err);
      showNotification('Error al limpiar datos', 'error');
    }
  } else {
    showNotification('Operación cancelada', 'info');
  }
}

function logSystemActivity(type, description) {
  try {
    const systemLogs = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'systemLogs') || '[]');
    
    systemLogs.push({
      id: Date.now(),
      type,
      description,
      date: new Date().toISOString(),
      user: currentUser ? currentUser.username : 'system'
    });
    
    // Keep only last 1000 logs
    while (systemLogs.length > 1000) {
      systemLogs.shift();
    }
    
    localStorage.setItem(CONFIG.storagePrefix + 'systemLogs', JSON.stringify(systemLogs));
  } catch(err) {
    console.error('Error logging system activity:', err);
  }
}

// Daily system update function (already included in your code)
function performSystemUpdate() {
  console.log('Performing daily system update:', new Date().toLocaleString());
  
  try {
    // Clean up old data
    const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Keep only unprocessed sales or sales less than 30 days old
    const filteredSales = sales.filter(sale => {
      if (!sale.processed) return true;
      const saleDate = new Date(sale.date);
      return saleDate >= thirtyDaysAgo;
    });
    
    // Save filtered sales
    localStorage.setItem(CONFIG.storagePrefix + 'sales', JSON.stringify(filteredSales));
    
    // Check for low inventory items
    const inventory = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'inventory') || '[]');
    const lowInventoryItems = inventory.filter(item => item.quantity <= 5);
    
    if (lowInventoryItems.length > 0) {
      showNotification(`${lowInventoryItems.length} items con stock bajo`, 'warning');
      
      // Log low inventory items
      lowInventoryItems.forEach(item => {
        logSystemActivity('low_inventory', `Stock bajo para ${item.name}: ${item.quantity} unidades`);
      });
    }
    
    // Update displays
    updateDashboard();
    updateInventoryDisplay();
    updateSalesDisplay();
    updateClientsDisplay();
    
    // Log update
    logSystemActivity('system_update', 'Actualización diaria del sistema completada');
    
    showNotification('Sistema actualizado correctamente', 'success');
  } catch (err) {
    console.error('Error during system update:', err);
    showNotification('Error actualizando el sistema', 'error');
    logSystemActivity('system_update_error', err.message);
  }
}

function updateSaleStatus() {
  // Check if user is admin
  if (currentUser && currentUser.role !== 'admin') {
    showNotification('Solo el administrador puede cambiar el estado de las ventas', 'warning');
    return;
  }
  
  const saleId = parseInt(document.getElementById('paymentForm').dataset.saleId);
  const paymentStatus = document.getElementById('editPaymentStatus').value;
  const saleStatus = document.getElementById('editSaleStatus').value;
  
  if (!saleId) {
    showNotification('ID de venta inválido', 'error');
    return;
  }
  
  const sales = JSON.parse(localStorage.getItem(CONFIG.storagePrefix + 'sales') || '[]');
  const saleIndex = sales.findIndex(s => s.id === saleId);
  
  if (saleIndex === -1) {
    showNotification('Venta no encontrada', 'error');
    return;
  }
  
  // Update status
  sales[saleIndex].paymentStatus = paymentStatus;
  sales[saleIndex].status = saleStatus;
  
  // Mark as processed if fully paid and completed
  if (paymentStatus === 'pagado' && saleStatus === 'completado') {
    sales[saleIndex].processed = true;
  }
  
  // Save changes
  localStorage.setItem(CONFIG.storagePrefix + 'sales', JSON.stringify(sales));
  
  // Close modal and update display
  const modal = bootstrap.Modal.getInstance(document.getElementById('saleDetailsModal'));
  if (modal) {
    modal.hide();
  }
  
  updateSalesDisplay();
  updateCashSummary();
  updateDashboard();
  
  showNotification('Estado de venta actualizado', 'success');
}

function logout() {
  // Remove from active cashiers list
  if (currentUser) {
    const index = activeCashiers.findIndex(cashier => cashier.username === currentUser.username);
    if (index !== -1) {
      activeCashiers.splice(index, 1);
    }
  }
  
  localStorage.removeItem('currentUser');
  currentUser = null;
  document.getElementById('loginContainer').classList.remove('d-none');
  document.getElementById('mainContainer').classList.add('d-none');
  showNotification('Sesión cerrada', 'info');
}

function generatePayrollReport(startDate, endDate, container) {
    // Sample payroll data - in a real app this would come from your database
    const payrollData = [
        {
            employeeId: 1,
            name: "Juan Pérez",
            position: "Vendedor",
            baseSalary: 25000,
            commission: 5000,
            deductions: 2000,
            totalPay: 28000
        },
        {
            employeeId: 2, 
            name: "María González",
            position: "Cajera",
            baseSalary: 20000,
            commission: 0,
            deductions: 1500,
            totalPay: 18500
        }
    ];

    // Calculate totals
    const totalBaseSalary = payrollData.reduce((sum, emp) => sum + emp.baseSalary, 0);
    const totalCommission = payrollData.reduce((sum, emp) => sum + emp.commission, 0);
    const totalDeductions = payrollData.reduce((sum, emp) => sum + emp.deductions, 0);
    const totalPayroll = payrollData.reduce((sum, emp) => sum + emp.totalPay, 0);

    const html = `
        <div class="alert alert-info mb-4">
            <strong>Reporte de Nómina desde ${formatDate(startDate)} hasta ${formatDate(endDate)}</strong>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total Empleados</h5>
                        <h3>${payrollData.length}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Salarios Base</h5>
                        <h3 class="number">${formatCurrency(totalBaseSalary)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Comisiones</h5>
                        <h3 class="number">${formatCurrency(totalCommission)}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light">
                    <div class="card-body text-center">
                        <h5>Total Nómina</h5>
                        <h3 class="number">${formatCurrency(totalPayroll)}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Empleado</th>
                        <th>Cargo</th>
                        <th class="number">Salario Base</th>
                        <th class="number">Comisión</th>
                        <th class="number">Deducciones</th>
                        <th class="number">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${payrollData.map(emp => `
                        <tr>
                            <td>${emp.employeeId}</td>
                            <td>${emp.name}</td>
                            <td>${emp.position}</td>
                            <td class="number">${formatCurrency(emp.baseSalary)}</td>
                            <td class="number">${formatCurrency(emp.commission)}</td>
                            <td class="number">${formatCurrency(emp.deductions)}</td>
                            <td class="number">${formatCurrency(emp.totalPay)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="table-info">
                        <td colspan="3"><strong>Totales</strong></td>
                        <td class="number"><strong>${formatCurrency(totalBaseSalary)}</strong></td>
                        <td class="number"><strong>${formatCurrency(totalCommission)}</strong></td>
                        <td class="number"><strong>${formatCurrency(totalDeductions)}</strong></td>
                        <td class="number"><strong>${formatCurrency(totalPayroll)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        
        <div class="mt-4 text-end">
            <button class="btn btn-primary" onclick="printReport()">
                <i class="bi bi-printer"></i> Imprimir Reporte
            </button>
        </div>
    `;
    
    container.innerHTML = html;
}

function printDeceasedRecords() {
    // Add print-specific class to body
    document.body.classList.add('printing-deceased');
    
    // Add current date to the section for printing
    const deceasedSection = document.getElementById('fallecidosSection');
    deceasedSection.setAttribute('data-print-date', new Date().toLocaleDateString());
    
    // Print the document
    window.print();
    
    // Remove print-specific class after printing
    window.onafterprint = function() {
        document.body.classList.remove('printing-deceased');
    };
}