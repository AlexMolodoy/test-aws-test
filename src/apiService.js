import { Amplify } from 'aws-amplify';
import { get, post, put, del } from 'aws-amplify/api';

const API_NAME = 'apib3e2cc07';

/**
 * REST API Service для работы с Items
 */
const apiService = {
  /**
   * Получить все элементы
   */
  async getItems() {
    try {
      const restOperation = get({
        apiName: API_NAME,
        path: '/items',
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data;
    } catch (error) {
      console.error('GET /items error:', error);
      throw error;
    }
  },

  /**
   * Получить элемент по ID
   */
  async getItem(id) {
    try {
      const restOperation = get({
        apiName: API_NAME,
        path: `/items/${id}`,
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data;
    } catch (error) {
      console.error(`GET /items/${id} error:`, error);
      throw error;
    }
  },

  /**
   * Создать новый элемент
   */
  async createItem(itemData) {
    try {
      const restOperation = post({
        apiName: API_NAME,
        path: '/items',
        options: {
          body: itemData,
        },
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data;
    } catch (error) {
      console.error('POST /items error:', error);
      throw error;
    }
  },

  /**
   * Обновить элемент
   */
  async updateItem(id, itemData) {
    try {
      const restOperation = put({
        apiName: API_NAME,
        path: `/items/${id}`,
        options: {
          body: itemData,
        },
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data;
    } catch (error) {
      console.error(`PUT /items/${id} error:`, error);
      throw error;
    }
  },

  /**
   * Удалить элемент
   */
  async deleteItem(id) {
    try {
      const restOperation = del({
        apiName: API_NAME,
        path: `/items/${id}`,
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return data;
    } catch (error) {
      console.error(`DELETE /items/${id} error:`, error);
      throw error;
    }
  },
};

export default apiService;
