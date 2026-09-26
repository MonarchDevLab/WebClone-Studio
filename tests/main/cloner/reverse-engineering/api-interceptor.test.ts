import { describe, expect, it } from 'vitest';
import { 
  ApiTrafficInterceptor, 
  findMockResponse, 
  CapturedApiEndpoint 
} from '../../../../src/main/cloner/reverse-engineering/api-interceptor';

describe('ApiTrafficInterceptor', () => {
  it('records and formats API endpoints', () => {
    const interceptor = new ApiTrafficInterceptor();
    const endpoint1: CapturedApiEndpoint = {
      url: 'https://example.com/api/v1/users?page=1',
      pathname: '/api/v1/users',
      method: 'GET',
      status: 200,
      contentType: 'application/json',
      responseData: [{ id: 1, name: 'Alice' }],
      timestamp: Date.now(),
    };

    interceptor.record(endpoint1);

    const schema = interceptor.exportMockDatabase();
    expect(schema['/api/v1/users']).toBeDefined();
    expect(schema['/api/v1/users']['GET']).toBeDefined();
    expect(schema['/api/v1/users']['GET'].status).toBe(200);
    expect(schema['/api/v1/users']['GET'].data).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('finds mock response by pathname and method', () => {
    const mockDb = {
      '/api/products': {
        GET: {
          status: 200,
          contentType: 'application/json',
          data: { products: ['Item A', 'Item B'] }
        },
        POST: {
          status: 201,
          contentType: 'application/json',
          data: { success: true }
        }
      }
    };

    const foundGet = findMockResponse(mockDb, '/api/products', 'GET');
    expect(foundGet).toBeDefined();
    expect(foundGet?.status).toBe(200);
    expect(foundGet?.data).toEqual({ products: ['Item A', 'Item B'] });

    const foundPost = findMockResponse(mockDb, '/api/products/', 'post');
    expect(foundPost).toBeDefined();
    expect(foundPost?.status).toBe(201);

    const notFound = findMockResponse(mockDb, '/api/orders', 'GET');
    expect(notFound).toBeNull();
  });
});
