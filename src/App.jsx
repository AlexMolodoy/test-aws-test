import { useState, useEffect, useCallback } from 'react';
import apiService from './apiService';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

// ============================================
// Toast Component
// ============================================
function Toast({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <span className="toast-icon">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Stats Bar Component
// ============================================
function StatsBar({ items, apiLogs }) {
  const categories = [...new Set(items.map((i) => i.category))];
  const successRate = apiLogs.length
    ? Math.round(
      (apiLogs.filter((l) => l.status === 'ok').length / apiLogs.length) * 100
    )
    : 100;

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-value">{items.length}</div>
        <div className="stat-label">Элементов</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{categories.length}</div>
        <div className="stat-label">Категорий</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{apiLogs.length}</div>
        <div className="stat-label">API запросов</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{successRate}%</div>
        <div className="stat-label">Успешных</div>
      </div>
    </div>
  );
}

// ============================================
// Item Form Component
// ============================================
function ItemForm({ editingItem, onSubmit, onCancel, loading }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description);
      setCategory(editingItem.category);
    } else {
      setName('');
      setDescription('');
      setCategory('general');
    }
  }, [editingItem]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, description, category });
    if (!editingItem) {
      setName('');
      setDescription('');
      setCategory('general');
    }
  };

  return (
    <div className="form-card">
      <h2 className="form-title">
        <span className="icon">{editingItem ? '✏️' : '➕'}</span>
        {editingItem ? 'Редактировать' : 'Новый элемент'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="item-name">
            Название *
          </label>
          <input
            id="item-name"
            className="form-input"
            type="text"
            placeholder="Введите название..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="item-description">
            Описание
          </label>
          <textarea
            id="item-description"
            className="form-textarea"
            placeholder="Описание элемента..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="item-category">
            Категория
          </label>
          <select
            id="item-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={loading}
          >
            <option value="general">🏷️ Общее</option>
            <option value="work">💼 Работа</option>
            <option value="personal">👤 Личное</option>
            <option value="ideas">💡 Идеи</option>
            <option value="urgent">🔥 Срочное</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
            {loading ? (
              <span className="loading-spinner">
                <span className="spinner"></span>
                Сохранение...
              </span>
            ) : editingItem ? (
              '💾 Сохранить'
            ) : (
              '➕ Создать'
            )}
          </button>
          {editingItem && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Отмена
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ============================================
// Item Card Component
// ============================================
function ItemCard({ item, onEdit, onDelete, loading }) {
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const categoryLabels = {
    general: '🏷️ Общее',
    work: '💼 Работа',
    personal: '👤 Личное',
    ideas: '💡 Идеи',
    urgent: '🔥 Срочное',
  };

  return (
    <div className="item-card">
      <div className="item-header">
        <span className="item-name">{item.name}</span>
        <div className="item-actions">
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => onEdit(item)}
            disabled={loading}
            title="Редактировать"
          >
            ✏️
          </button>
          <button
            className="btn btn-danger btn-icon"
            onClick={() => onDelete(item.id)}
            disabled={loading}
            title="Удалить"
          >
            🗑️
          </button>
        </div>
      </div>
      {item.description && (
        <p className="item-description">{item.description}</p>
      )}
      <div className="item-meta">
        <span className="item-category">
          {categoryLabels[item.category] || item.category}
        </span>
        <span className="item-date">📅 {formatDate(item.createdAt)}</span>
        <span className="item-id">ID: {item.id.slice(0, 8)}...</span>
      </div>
    </div>
  );
}

// ============================================
// API Log Component
// ============================================
function ApiLog({ logs, onClear }) {
  if (logs.length === 0) return null;

  return (
    <div className="api-log">
      <div className="api-log-header">
        <span className="api-log-title">📡 API Log</span>
        <button className="btn btn-secondary btn-sm" onClick={onClear}>
          Очистить
        </button>
      </div>
      <div className="api-log-entries">
        {logs
          .slice()
          .reverse()
          .map((log, i) => (
            <div key={i} className="api-log-entry">
              <span className={`api-log-method ${log.method}`}>
                {log.method}
              </span>
              <span className="api-log-path">{log.path}</span>
              <span className={`api-log-status ${log.status}`}>
                {log.status === 'ok' ? '200' : 'ERR'}
              </span>
              <span className="api-log-time">{log.time}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ============================================
// Main App Component
// ============================================
function App() {
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [apiLogs, setApiLogs] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const addLog = useCallback((method, path, status) => {
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setApiLogs((prev) => [...prev, { method, path, status, time }]);
  }, []);

  // Fetch all items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiService.getItems();
      setItems(result.data || []);
      addLog('GET', '/items', 'ok');
    } catch (error) {
      addToast('Ошибка загрузки данных', 'error');
      addLog('GET', '/items', 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog, addToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Create or Update item
  const handleSubmit = async (itemData) => {
    setLoading(true);
    try {
      if (editingItem) {
        const result = await apiService.updateItem(editingItem.id, itemData);
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? result.data : i))
        );
        setEditingItem(null);
        addToast('Элемент обновлён');
        addLog('PUT', `/items/${editingItem.id.slice(0, 8)}`, 'ok');
      } else {
        const result = await apiService.createItem(itemData);
        setItems((prev) => [...prev, result.data]);
        addToast('Элемент создан');
        addLog('POST', '/items', 'ok');
      }
    } catch (error) {
      addToast(
        editingItem ? 'Ошибка обновления' : 'Ошибка создания',
        'error'
      );
      addLog(editingItem ? 'PUT' : 'POST', '/items', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await apiService.deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (editingItem?.id === id) setEditingItem(null);
      addToast('Элемент удалён');
      addLog('DELETE', `/items/${id.slice(0, 8)}`, 'ok');
    } catch (error) {
      addToast('Ошибка удаления', 'error');
      addLog('DELETE', `/items/${id.slice(0, 8)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Authenticator>
        {({ signOut, user }) => (
          <>

            <Toast toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

            {/* Header */}
            <header className="header">
              <div className="header-badge">
                <span className="pulse"></span>
                REST API Dashboard
              </div>
              <h1>Items Manager</h1>
              <p>Полноценный CRUD REST API на AWS Amplify + API Gateway + Lambda</p>
              <div className="header-user">
                <span className="header-username">{user?.signInDetails?.loginId}</span>
                <button className="btn btn-secondary btn-sm" onClick={signOut}>
                  Выйти
                </button>
              </div>
            </header>

            {/* Stats */}
            <StatsBar items={items} apiLogs={apiLogs} />

            {/* Main content */}
            <div className="main-layout">
              {/* Form */}
              <ItemForm
                editingItem={editingItem}
                onSubmit={handleSubmit}
                onCancel={() => setEditingItem(null)}
                loading={loading}
              />

              {/* Items List */}
              <div className="items-section">
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="icon">📋</span>
                    Элементы
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {loading && (
                      <span className="loading-spinner">
                        <span className="spinner"></span>
                      </span>
                    )}
                    <span className="items-count">{items.length} шт.</span>
                    <button className="btn btn-secondary btn-sm" onClick={fetchItems} disabled={loading}>
                      🔄 Обновить
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="empty-state">
                    <div className="icon">📭</div>
                    <h3>Пока нет элементов</h3>
                    <p>Создайте первый элемент используя форму слева</p>
                  </div>
                ) : (
                  <div className="items-list">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onEdit={setEditingItem}
                        onDelete={handleDelete}
                        loading={loading}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* API Log */}
            <ApiLog logs={apiLogs} onClear={() => setApiLogs([])} />

          </>
        )}
      </Authenticator>

    </div>
  );
}

export default App;
