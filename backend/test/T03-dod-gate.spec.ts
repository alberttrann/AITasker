import { JwtFactory } from './helpers/jwt.factory';
import { MilestoneBuilder } from './helpers/mock.builders';

describe('T03: Definition of Done Gate (Minh Thuc) - Helpers Validation', () => {

  // 1. Kiểm thử JwtFactory
  it('should successfully create a mock JWT token using JwtFactory', () => {
    const token = JwtFactory.createToken({
      sub : 'user_123',
      activeRole : 'CLIENT',
      clientSubtype : 'CEO',
    });

  
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  // 2. Kiểm thử MilestoneBuilder
  it('should successfully build a mock CreateMilestoneDto using MilestoneBuilder', () => {
    const mockAmount = 7500000;
    
    // Sử dụng Builder để tạo một DTO giả lập với số tiền tùy chỉnh
    const milestoneDto = new MilestoneBuilder()
      .withPaymentAmount(mockAmount)
      .build();

    // Kiểm tra xem Builder có gán đúng số tiền tùy chỉnh và các trường mặc định không
    expect(milestoneDto.payment_amount_vnd).toBe(mockAmount);
    expect(milestoneDto.deliverable_statement).toBeDefined();
    expect(milestoneDto.criteria.length).toBeGreaterThan(0);
  });

});