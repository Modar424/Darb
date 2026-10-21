-- One-time local setup (run as a MySQL/MariaDB admin, e.g.:  mysql -u root -p < database/setup.sql)
-- Creates the development + test databases and a least-privilege application user.
CREATE DATABASE IF NOT EXISTS lms_dev  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS lms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'lms'@'localhost'  IDENTIFIED BY 'MySql@2027#modar';
CREATE USER IF NOT EXISTS 'lms'@'127.0.0.1' IDENTIFIED BY 'MySql@2027#modar';
-- Keep rerunning this setup script safe when the local account already exists.
ALTER USER 'lms'@'localhost' IDENTIFIED BY 'MySql@2027#modar';
ALTER USER 'lms'@'127.0.0.1' IDENTIFIED BY 'MySql@2027#modar';
GRANT ALL PRIVILEGES ON lms_dev.*  TO 'lms'@'localhost';
GRANT ALL PRIVILEGES ON lms_test.* TO 'lms'@'localhost';
GRANT ALL PRIVILEGES ON lms_dev.*  TO 'lms'@'127.0.0.1';
GRANT ALL PRIVILEGES ON lms_test.* TO 'lms'@'127.0.0.1';
FLUSH PRIVILEGES;
