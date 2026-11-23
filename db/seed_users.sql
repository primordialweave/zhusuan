-- 历史 SQLite 演示数据，仅用于一次性测试数据库，参见 db/README.md。
-- 当前应用启动由 internal/database/seed.go 生成随机密码，不执行此文件。

INSERT INTO users (id, username, password, name, email, phone, role, department, position, status, create_time) VALUES 
(1, 'admin', '$2a$10$sp/NLWYRQjt9zVCq6HeOieFaFNBl79RoBXdePqxg9UhwQyT1/C7vu', '管理员', 'admin@example.com', '13800000000', 'admin', '技术部', '系统管理员', 1, CURRENT_TIMESTAMP);

-- 历史测试用户，与上方记录沿用同一演示密码哈希。
INSERT INTO users (id, username, password, name, email, phone, role, department, position, status, create_time) VALUES 
(2, 'xu', '$2a$10$sp/NLWYRQjt9zVCq6HeOieFaFNBl79RoBXdePqxg9UhwQyT1/C7vu', '郑旭', 'xu@company.com', '13800000001', 'user', '技术部', '项目经理', 1, CURRENT_TIMESTAMP);
