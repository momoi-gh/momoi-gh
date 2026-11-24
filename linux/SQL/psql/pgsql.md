## cli

> 注意：psql 元命令（反斜杠命令）不支持行尾注释。`\dt -- 列出表` 会把 `--` 当成表名，`#` 也不是 psql 注释。注释必须单独写一行（只有 shell 命令块里才用 `#`）。

### 帮助

```sql
-- 列出所有元命令及其说明
\?

-- 查看 SQL 语法帮助，例如 CREATE TABLE
\h
\h CREATE TABLE
```

### 连接（shell）

```bash
# 连接指定数据库
psql -h 127.0.0.1 -p 5432 -U bs -d bs_chat

# 连接时强制提示输入密码
psql -h 127.0.0.1 -p 5432 -U bs -d bs_chat -W

# 使用连接串
psql "postgres://bs:bs_dev_password@127.0.0.1:5432/bs_chat"

# 执行一条 SQL 后退出
psql -U bs -d bs_chat -c 'SELECT version();'

# 执行 SQL 文件，遇到错误立即停止
psql -U bs -d bs_chat -v ON_ERROR_STOP=1 -f init.sql
```

### 数据库与 Schema

```sql
-- 列出所有数据库（加号显示大小、描述等）
\l
\l+

-- 切换数据库
\c bs_chat

-- 查看当前连接信息
\conninfo

-- 列出 Schema（加号显示属主和权限）
\dn
\dn+

-- 列出表 / 视图 / 物化视图 / 序列 / 索引
\dt
\dv
\dm
\ds
\di

-- 只列出 public schema 下的表
\dt public.*

-- 列出已安装的扩展
\dx
```

### 表结构

```sql
-- 查看表结构：字段、类型、默认值、约束、索引、外键
\d users

-- 查看更详细的信息（存储参数、描述等）
\d+ users

-- 查看视图定义
\sv 视图名

-- 查看函数定义
\sf 函数名

-- 查看表 / 视图 / 序列的权限
\dp users
\z users
```

### 用户与权限

```sql
-- 列出角色（用户）
\du
\du+

-- 修改当前用户密码（交互式输入，不显示明文）
\password

-- 修改指定用户的密码
\password bs
```

### 查询与输出

```sql
-- 扩展显示（竖排），字段多时更好读；auto 会自动判断
\x
\x auto

-- 只显示数据行，不显示表头和行数
\t

-- 设置 NULL 的显示文本
\pset null '(NULL)'

-- 打开 / 关闭计时
\timing on
\timing off

-- 把查询结果输出到文件；不带文件名则恢复输出到终端
\o /tmp/result.txt
\o

-- 执行脚本文件
\i /tmp/init.sql

-- 执行 shell 命令
\! ls -l
```

### 常用查询

```sql
-- 当前数据库、用户和版本
SELECT current_database(), current_user, version();

-- 当前数据库大小
SELECT pg_size_pretty(pg_database_size(current_database()));

-- 单表大小（包含索引）
SELECT pg_size_pretty(pg_total_relation_size('users'));

-- 当前连接及正在执行的 SQL
SELECT pid, usename, state, query FROM pg_stat_activity;

-- 终止指定连接
SELECT pg_terminate_backend(12345);

-- 查看某张表的所有索引
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
```

### 备份与恢复（shell）

```bash
# 导出为自定义格式（推荐，配合 pg_restore 使用）
pg_dump -U bs -d bs_chat -Fc -f bs_chat.dump

# 导出为纯 SQL
pg_dump -U bs -d bs_chat -f bs_chat.sql

# 只导出结构 / 只导出数据
pg_dump -U bs -d bs_chat -s -f schema.sql
pg_dump -U bs -d bs_chat -a -f data.sql

# 恢复自定义格式（--clean 先删除已有对象，--if-exists 避免删除时报错）
pg_restore -U bs -d bs_chat --clean --if-exists bs_chat.dump
# 并行恢复（4个任务）
-j 4 

# 恢复纯 SQL 文件
psql -U bs -d bs_chat -f bs_chat.sql

# 备份所有数据库和角色
pg_dumpall -U bs -f all.sql
```

### 退出

```sql
-- 退出 psql
\q
```

## podman&
```
podman exec -it bs-postgres psql -U bs -d bs_chat
```


```
podman volume inspect bs_pgdata --format '{{.Mountpoint}}'
```

```
host=127.0.0.1  port=5432  user=bs  password=bs_dev_password  db=bs_chat
```

```
DATABASE_URL=postgres://bs:bs_dev_password@127.0.0.1:5432/bs_chat
```