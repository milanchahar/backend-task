const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '/api' 
  : 'https://finance-tracker-backend-milan.onrender.com/api'; // Placeholder, user will need to update this or I can use a generic one if I know it.
let AUTH_TOKEN = localStorage.getItem('token');
let currentUser = null;
let charts = {};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  if (AUTH_TOKEN) {
    showApp();
  } else {
    showAuth();
  }
});

// Navigation & Tabs
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
  
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`${tab}-form`).classList.remove('hidden');
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(`section-${sectionId}`).classList.remove('hidden');
  document.getElementById(`nav-${sectionId}`).classList.add('active');
  
  // Load data for the section
  if (sectionId === 'dashboard') loadDashboard();
  if (sectionId === 'transactions') loadTransactions();
  if (sectionId === 'categories') loadCategories();
  if (sectionId === 'budgets') loadBudgets();
  if (sectionId === 'reports') loadReports();
}

// Auth Handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      AUTH_TOKEN = data.token;
      localStorage.setItem('token', AUTH_TOKEN);
      showApp();
    } else {
      document.getElementById('login-error').innerText = data.message;
    }
  } catch (err) {
    showToast('Login failed. Please try again.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast('Account created! Please login.');
      switchTab('login');
    } else {
      document.getElementById('reg-error').innerText = data.message;
    }
  } catch (err) {
    showToast('Registration failed.');
  }
}

function logout() {
  AUTH_TOKEN = null;
  localStorage.removeItem('token');
  showAuth();
}

function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  showSection('dashboard');
}

// API Helpers
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    ...options.headers
  };
  
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Unauthorized');
  }
  
  return res;
}

// Data Loading
async function loadCategories() {
  const res = await apiFetch('/categories');
  const categories = await res.json();
  
  const tbody = document.getElementById('categories-tbody');
  tbody.innerHTML = categories.map(c => `
    <tr>
      <td>${c.name}</td>
      <td><span class="badge ${c.type}">${c.type}</span></td>
      <td>
        <button class="btn-icon" onclick="deleteCategory(${c.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
  
  // Update category selects in modals
  const selects = ['tx-category', 'budget-category'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="">Select Category</option>' + 
      categories.map(c => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('');
  });
}

async function loadTransactions() {
  const res = await apiFetch('/transactions');
  const transactions = await res.json();
  
  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td>${new Date(t.date).toLocaleDateString()}</td>
      <td>${t.description}</td>
      <td>${t.category.name}</td>
      <td>${t.currency}</td>
      <td class="${t.category.type === 'expense' ? 'text-expense' : 'text-income'}">
        ${t.category.type === 'expense' ? '-' : '+'}${t.amount}
      </td>
      <td>
        ${t.receiptUrl ? `<a href="${t.receiptUrl}" target="_blank">📄 View</a>` : '-'}
      </td>
      <td>
        <button class="btn-icon" onclick="editTransaction(${JSON.stringify(t).replace(/"/g, '&quot;')})">✏️</button>
        <button class="btn-icon" onclick="deleteTransaction(${t.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function loadDashboard() {
  const res = await apiFetch('/dashboard');
  const data = await res.json();
  
  document.getElementById('dash-income').innerText = `$${data.totalIncome.toFixed(2)}`;
  document.getElementById('dash-expense').innerText = `$${data.totalExpense.toFixed(2)}`;
  document.getElementById('dash-savings').innerText = `$${data.savings.toFixed(2)}`;
  
  // Recent transactions list
  const list = document.getElementById('recent-transactions-list');
  list.innerHTML = data.recentTransactions.map(t => `
    <div class="recent-item">
      <div>
        <strong>${t.description}</strong>
        <div class="subtitle">${t.category.name}</div>
      </div>
      <div class="${t.category.type === 'expense' ? 'text-expense' : 'text-income'}">
        ${t.category.type === 'expense' ? '-' : '+'}${t.amount}
      </div>
    </div>
  `).join('');
  
  // Pie Chart
  updatePieChart(data.expenseByCategory);
}

function updatePieChart(data) {
  const ctx = document.getElementById('expense-pie-chart').getContext('2d');
  if (charts.pie) charts.pie.destroy();
  
  const labels = Object.keys(data);
  const values = Object.values(data);
  
  charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } } }
  });
}

async function loadBudgets() {
  const res = await apiFetch('/budgets');
  const budgets = await res.json();
  
  const grid = document.getElementById('budgets-list');
  grid.innerHTML = budgets.map(b => {
    const percent = Math.min((b.spent / b.limitAmount) * 100, 100);
    const colorClass = percent > 90 ? 'danger' : (percent > 70 ? 'warning' : '');
    
    return `
      <div class="budget-card">
        <div class="section-header">
          <h3>${b.category.name}</h3>
          <button class="btn-icon" onclick="deleteBudget(${b.id})">🗑️</button>
        </div>
        <div class="subtitle">Month: ${b.month}</div>
        <div class="budget-progress-bg">
          <div class="budget-progress-bar ${colorClass}" style="width: ${percent}%"></div>
        </div>
        <div class="flex-between">
          <span>Spent: $${b.spent.toFixed(2)}</span>
          <span>Limit: $${parseFloat(b.limitAmount).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function loadReports() {
  const year = document.getElementById('report-year').value;
  const res = await apiFetch(`/reports?year=${year}`);
  const data = await res.json();
  
  const ctx = document.getElementById('monthly-bar-chart').getContext('2d');
  if (charts.bar) charts.bar.destroy();
  
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        { label: 'Income', data: data.monthlyReport.map(m => m.income), backgroundColor: '#10b981' },
        { label: 'Expense', data: data.monthlyReport.map(m => m.expense), backgroundColor: '#ef4444' }
      ]
    }
  });
}

// Action Handlers
async function handleSaveCategory(e) {
  e.preventDefault();
  const name = document.getElementById('cat-name').value;
  const type = document.getElementById('cat-type').value;
  const btn = e.target.querySelector('button[type="submit"]');
  
  try {
    btn.disabled = true;
    const res = await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, type })
    });
    
    const data = await res.json();
    if (res.ok) {
      closeModal('add-category-modal');
      loadCategories();
      showToast('Category added!');
      document.getElementById('cat-name').value = '';
    } else {
      showToast(data.message || 'Failed to add category');
    }
  } catch (err) {
    showToast('An error occurred');
  } finally {
    btn.disabled = false;
  }
}

async function handleSaveTransaction(e) {
  e.preventDefault();
  const id = document.getElementById('tx-edit-id').value;
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  
  try {
    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    const receiptFile = document.getElementById('tx-receipt').files[0];
    let receiptUrl = null;
    
    if (receiptFile) {
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      const uploadRes = await apiFetch('/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Receipt upload failed');
      const uploadData = await uploadRes.json();
      receiptUrl = uploadData.receiptUrl;
    }
    
    const body = {
      description: document.getElementById('tx-description').value,
      amount: parseFloat(document.getElementById('tx-amount').value),
      currency: document.getElementById('tx-currency').value,
      date: document.getElementById('tx-date').value,
      categoryId: document.getElementById('tx-category').value,
    };
    
    if (receiptUrl) body.receiptUrl = receiptUrl;
    
    const endpoint = id ? `/transactions/${id}` : '/transactions';
    const method = id ? 'PUT' : 'POST';
    
    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (res.ok) {
      closeModal('add-transaction-modal');
      loadTransactions();
      showToast(id ? 'Transaction updated!' : 'Transaction added!');
    } else {
      showToast(data.message || 'Failed to save transaction');
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || 'An error occurred');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

async function handleSaveBudget(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  
  try {
    btn.disabled = true;
    const body = {
      categoryId: document.getElementById('budget-category').value,
      month: document.getElementById('budget-month').value,
      limitAmount: document.getElementById('budget-limit').value,
    };
    
    const res = await apiFetch('/budgets', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (res.ok) {
      closeModal('add-budget-modal');
      loadBudgets();
      showToast('Budget set!');
    } else {
      showToast(data.message || 'Failed to set budget');
    }
  } catch (err) {
    showToast('An error occurred');
  } finally {
    btn.disabled = false;
  }
}

async function deleteTransaction(id) {
  if (!confirm('Are you sure?')) return;
  const res = await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
  if (res.ok) { loadTransactions(); showToast('Deleted!'); }
}

async function deleteCategory(id) {
  if (!confirm('Are you sure? This might fail if transactions exist.')) return;
  const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  if (res.ok) { loadCategories(); showToast('Deleted!'); }
  else {
    const data = await res.json();
    showToast(data.message);
  }
}

async function deleteBudget(id) {
  if (!confirm('Are you sure?')) return;
  const res = await apiFetch(`/budgets/${id}`, { method: 'DELETE' });
  if (res.ok) { loadBudgets(); showToast('Deleted!'); }
}

// AI Functions
async function getInsights() {
  const output = document.getElementById('ai-output');
  output.innerText = 'Analyzing your data...';
  output.classList.remove('hidden');
  
  try {
    const res = await apiFetch('/ai/insights');
    const data = await res.json();
    output.innerText = data.insights;
  } catch (err) {
    output.innerText = 'Failed to get insights. Make sure OPENAI_API_KEY is set.';
  }
}

async function detectAnomalies() {
  const output = document.getElementById('ai-output');
  output.innerText = 'Scanning for anomalies...';
  output.classList.remove('hidden');
  
  try {
    const res = await apiFetch('/ai/anomalies');
    const data = await res.json();
    if (data.anomalies.length === 0) {
      output.innerText = 'No anomalies detected! Your spending looks normal.';
    } else {
      output.innerText = 'Anomalies detected:\n' + data.anomalies.map(a => `- ${a.date}: ${a.description} (${a.reason})`).join('\n');
    }
  } catch (err) {
    output.innerText = 'Anomaly detection failed.';
  }
}

// Import Handlers
async function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('statement', file);
  
  const output = document.getElementById('import-result');
  output.innerText = 'Importing...';
  output.classList.remove('hidden');
  
  try {
    const res = await apiFetch('/import/csv', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    output.innerText = `Import Complete!\nSuccess: ${data.results.imported}\nDuplicates: ${data.results.duplicates}\nErrors: ${data.results.errors}`;
    showToast('Import finished');
  } catch (err) {
    output.innerText = 'Import failed.';
  }
}

// UI Utilities
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'add-transaction-modal') {
    document.getElementById('tx-edit-id').value = '';
    document.getElementById('transaction-modal-title').innerText = 'Add Transaction';
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function editTransaction(t) {
  openModal('add-transaction-modal');
  document.getElementById('transaction-modal-title').innerText = 'Edit Transaction';
  document.getElementById('tx-edit-id').value = t.id;
  document.getElementById('tx-description').value = t.description;
  document.getElementById('tx-amount').value = t.amount;
  document.getElementById('tx-currency').value = t.currency;
  document.getElementById('tx-date').value = t.date.split('T')[0];
  document.getElementById('tx-category').value = t.categoryId;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
