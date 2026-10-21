// Runs in every integration test worker BEFORE modules are imported.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.TEST_DB_HOST ?? '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '3306';
process.env.DB_USER = process.env.TEST_DB_USER ?? 'lms';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'change_me_local_only';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'lms_test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';
process.env.THROTTLE_LIMIT = '100000';
process.env.AUTH_THROTTLE_LIMIT = '1000';
process.env.ARGON2_MEMORY_KIB = '1024'; // fast hashing in tests only
process.env.ARGON2_TIME_COST = '1';
process.env.LOGIN_MAX_FAILURES = '5';
process.env.LOG_LEVEL = 'silent';
