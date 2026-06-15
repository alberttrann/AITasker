module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.spec.ts$', // Tìm các file có đuôi .spec.ts trong thư mục test
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  maxWorkers: 1, // Giới hạn 1 worker để chạy tuần tự (In-band), tránh xung đột Database
}; 