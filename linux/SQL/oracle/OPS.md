
#数据字典与常用视图
--
运维排查的第一步是知道去哪儿查。Oracle 的数据字典按权限范围分三层：

| 前缀 | 含义 |
| --- | --- |
| `USER_` | 当前用户拥有的对象 |
| `ALL_` | 当前用户可以访问的对象 |
| `DBA_` | 全库对象，需 `SELECT_CATALOG_ROLE` 或 DBA 权限 |

```sql
-- 当前用户能看到的表
SELECT table_name FROM user_tables;

-- 全库表空间
SELECT tablespace_name, status, contents FROM dba_tablespaces;

-- 动态性能视图：实例运行状态，前缀 v$ / gv$
SELECT name FROM v$fixed_table WHERE name LIKE 'V$SESSION%';
```

`DBA_*` 是静态字典（存在磁盘上），`V$*` 是动态性能视图（来自内存，实例重启即清零）[^1]；RAC 环境用 `GV$*` 看所有节点[^2]。

---

#实例状态与启停
--
```sql
-- 实例处于哪个阶段
SELECT instance_name, host_name, status, database_status
FROM   v$instance;

-- 数据库角色、归档模式、打开模式
SELECT name, dbid, log_mode, open_mode, database_role
FROM   v$database;
```

正常启停：

```sql
SHUTDOWN IMMEDIATE;      -- 断开会话、回滚未提交事务、 checkpoint
STARTUP;                 -- 直接到 OPEN

-- 分阶段启动（维护时常用）
STARTUP NOMOUNT;         -- 只读参数文件、启动后台进程
ALTER DATABASE MOUNT;    -- 读控制文件
ALTER DATABASE OPEN;     -- 打开数据文件
```

启动分 `NOMOUNT → MOUNT → OPEN` 三阶段[^3]。开归档、改日志、恢复控制文件都必须在 `MOUNT` 阶段做；`SHUTDOWN ABORT` 相当于强杀，下次启动要做实例恢复[^4]。

---

#表空间使用率
--
```sql
SELECT d.tablespace_name,
       ROUND(d.alloc_mb, 2)                                AS alloc_mb,
       ROUND(d.alloc_mb - NVL(f.free_mb, 0), 2)            AS used_mb,
       ROUND((d.alloc_mb - NVL(f.free_mb, 0))
             / d.alloc_mb * 100, 2)                        AS used_pct
FROM   (SELECT tablespace_name, SUM(bytes) / 1024 / 1024 AS alloc_mb
        FROM   dba_data_files
        GROUP  BY tablespace_name) d
LEFT   JOIN (SELECT tablespace_name, SUM(bytes) / 1024 / 1024 AS free_mb
             FROM   dba_free_space
             GROUP  BY tablespace_name) f
       ON d.tablespace_name = f.tablespace_name
ORDER  BY used_pct DESC;
```

11g 以后可以直接用视图：

```sql
SELECT tablespace_name, used_percent,
       ROUND(tablespace_size / 1024 / 1024, 2) AS size_mb,
       ROUND(used_space      / 1024 / 1024, 2) AS used_mb
FROM   dba_tablespace_usage_metrics
ORDER  BY used_percent DESC;
```

`dba_data_files` 是数据文件已分配的大小，`dba_free_space` 是其中空闲 extent 的大小，两者相减才是真实使用量[^5]。注意 `dba_data_files` 不包含临时表空间，临时表空间要查 `dba_temp_files`[^6]。

---

#数据文件扩容
--
```sql
-- 1. 直接扩大当前数据文件
ALTER DATABASE DATAFILE '/u01/app/oracle/oradata/ORCL/users01.dbf'
  RESIZE 2G;

-- 2. 打开自动扩展：每次涨 100M，最多到 8G
ALTER DATABASE DATAFILE '/u01/app/oracle/oradata/ORCL/users01.dbf'
  AUTOEXTEND ON NEXT 100M MAXSIZE 8G;

-- 3. 给表空间新增一个数据文件
ALTER TABLESPACE users
  ADD DATAFILE '/u01/app/oracle/oradata/ORCL/users02.dbf'
  SIZE 1G AUTOEXTEND ON NEXT 100M MAXSIZE 8G;
```

`RESIZE` 的值不能小于文件已用的高水位，否则报 `ORA-03297`[^7]。自动扩展虽然省事，但 `MAXSIZE UNLIMITED` 可能把磁盘写满，生产建议设上限并配合监控[^8]。

---

#临时表空间
--
```sql
-- 哪些会话在占用 TEMP
SELECT s.sid, s.serial#, s.username,
       u.tablespace, u.segtype,
       ROUND(u.blocks * 8 / 1024, 2) AS mb
FROM   v$session s
JOIN   v$tempseg_usage u ON s.saddr = u.session_addr
ORDER  BY mb DESC;

-- TEMP 使用率
SELECT tablespace_name,
       ROUND(tablespace_size  / 1024 / 1024, 2) AS size_mb,
       ROUND(allocated_space  / 1024 / 1024, 2) AS alloc_mb,
       ROUND(free_space       / 1024 / 1024, 2) AS free_mb
FROM   dba_temp_free_space;
```

排序、哈希连接、全局临时表、索引重建都会用临时段；临时段不产生 redo，但会占用磁盘[^9]。TEMP 撑爆时报 `ORA-01652: unable to extend temp segment`，先加临时文件再找大 SQL[^10]。

```sql
ALTER TABLESPACE temp
  ADD TEMPFILE '/u01/app/oracle/oradata/ORCL/temp02.dbf'
  SIZE 2G AUTOEXTEND ON NEXT 100M MAXSIZE 8G;
```

---

#UNDO 与回滚
--
```sql
SHOW PARAMETER undo_retention;

SELECT * FROM (
  SELECT begin_time, end_time, undoblks,
         maxquerylen, maxconcurrency
  FROM   v$undostat
  ORDER  BY begin_time DESC
) WHERE ROWNUM <= 12;
```

`MAXQUERYLEN` 是最近一段窗口内最长查询的秒数，应小于 `undo_retention`，否则长查询可能报 `ORA-01555: snapshot too old`[^11]。UNDO 表空间不足会让 DML 失败（`ORA-30036`），排查：

```sql
SELECT tablespace_name, status, SUM(bytes) / 1024 / 1024 AS mb
FROM   dba_undo_extents
GROUP  BY tablespace_name, status;
```

`ACTIVE` 是仍在使用的 undo，`UNEXPIRED` 是还没到 retention 的，`EXPIRED` 可被覆盖[^12]。

---

#归档模式与归档日志
--
```sql
ARCHIVE LOG LIST;
SELECT log_mode FROM v$database;
```

开启归档（必须在 `MOUNT` 阶段）：

```sql
SHUTDOWN IMMEDIATE;
STARTUP MOUNT;
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
```

清理归档日志：

```sql
-- 先确认已备份，再删 7 天前的
RMAN> DELETE ARCHIVELOG ALL COMPLETED BEFORE 'SYSDATE-7';
```

归档模式是联机热备和不完全恢复（按时间点恢复）的前提[^13]。FRA（快速恢复区）写满后，数据库会挂起所有 DML，告警日志出现 `ORACLE instance stuck`，所以必须监控 `db_recovery_file_dest_size`[^14]。

```sql
SELECT * FROM v$recovery_file_dest;
SELECT * FROM v$flash_recovery_area_usage;
```

---

#在线重做日志
--
```sql
SELECT group#, thread#, sequence#, bytes / 1024 / 1024 AS mb,
       status, archived
FROM   v$log
ORDER  BY group#;

SELECT group#, member FROM v$logfile ORDER BY group#;

-- 手工切换日志，触发归档
ALTER SYSTEM SWITCH LOGFILE;

-- 增加一组日志，两个成员放不同磁盘
ALTER DATABASE ADD LOGFILE GROUP 4
  ('/u01/app/oracle/oradata/ORCL/redo04a.log',
   '/u02/app/oracle/oradata/ORCL/redo04b.log') SIZE 200M;
```

日志组状态：`CURRENT` 正在写、`ACTIVE` 还没 checkpoint 完、`INACTIVE` 可复用、`UNUSED` 从未写过[^15]。日志组太小或太少，频繁切换会导致 `checkpoint not complete`，表现为 DML 卡住；一般每组 2~3 个成员做多路复用[^16]。

---

#会话与阻塞
--
```sql
-- 当前用户会话
SELECT sid, serial#, username, status, machine, program, sql_id, event
FROM   v$session
WHERE  type = 'USER';

-- 谁阻塞了谁
SELECT sid, serial#, username, blocking_session,
       event, seconds_in_wait
FROM   v$session
WHERE  blocking_session IS NOT NULL;
```

处理阻塞会话：

```sql
-- 12c 及以上
ALTER SYSTEM KILL SESSION '123,456' IMMEDIATE;
ALTER SYSTEM DISCONNECT SESSION '123,456' IMMEDIATE;

-- 11g
ALTER SYSTEM KILL SESSION '123,456';
```

`KILL SESSION` 只是给会话打上 killed 标记，事务回滚完才真正退出，大事务可能要等很久[^17]。`DISCONNECT SESSION IMMEDIATE` 会直接断开连接，但事务仍需 PMON 回滚。若在操作系统层 `kill -9` 了服务进程，必须再执行一次 `KILL SESSION` 清理残留[^18]。

---

#锁
--
```sql
SELECT l.sid, l.type, l.lmode, l.request, l.block,
       CASE WHEN l.type = 'TM' THEN o.object_name END AS object_name,
       s.username, s.program
FROM   v$lock l
LEFT   JOIN dba_objects o ON l.type = 'TM' AND l.id1 = o.object_id
LEFT   JOIN v$session s   ON l.sid = s.sid
WHERE  l.type IN ('TM', 'TX');
```

`TM` 是表级锁（DML 时防止 DDL 改表结构），`TX` 是事务锁/行锁[^19]。`BLOCK = 1` 表示该会话正在等锁；配合 `v$session.blocking_session` 找到源头。最常见的原因是应用执行了 DML 却没 `COMMIT`，其次是外键没建索引导致子表 DML 锁父表[^20]。

---

#等待事件与性能
--
```sql
-- 当前非空闲等待，按会话数排序
SELECT event, wait_class, COUNT(*) AS sessions
FROM   v$session
WHERE  wait_class <> 'Idle'
AND    type = 'USER'
GROUP  BY event, wait_class
ORDER  BY sessions DESC;

-- 实例级 TOP 等待
SELECT * FROM (
  SELECT event, total_waits, time_waited
  FROM   v$system_event
  WHERE  wait_class <> 'Idle'
  ORDER  BY time_waited DESC
) WHERE ROWNUM <= 10;
```

常见等待事件的含义[^21]：

| 等待事件 | 含义 | 方向 |
| --- | --- | --- |
| `db file sequential read` | 单块读，通常走索引 | 检查索引与回表 |
| `db file scattered read` | 多块读，全表/索引快速扫描 | 检查全表扫描是否合理 |
| `log file sync` | 等待 LGWR 写日志，提交慢 | 检查日志盘 IO |
| `enq: TX - row lock contention` | 行锁等待 | 找阻塞会话 |
| `latch free` / `cursor: pin S` | 共享池争用 | 检查硬解析、绑定变量 |

`v$session_wait` 在 10g 后已被 `v$session` 的 `event` 等列取代[^22]。

---

#慢 SQL 定位
--
```sql
SELECT * FROM (
  SELECT sql_id, executions,
         ROUND(elapsed_time / 1e6, 2)                            AS total_sec,
         ROUND(elapsed_time / 1e6 / NULLIF(executions, 0), 2)    AS avg_sec,
         ROUND(buffer_gets / NULLIF(executions, 0))              AS avg_gets,
         sql_text
  FROM   v$sqlarea
  WHERE  executions > 0
  ORDER  BY elapsed_time DESC
) WHERE ROWNUM <= 20;
```

看执行计划：

```sql
SELECT * FROM TABLE(
  DBMS_XPLAN.DISPLAY_CURSOR('&sql_id', NULL, 'ALLSTATS LAST'));
```

`v$sqlarea` 里要看 `avg_sec` 和 `avg_gets`，单看 `elapsed_time` 会把“执行次数多”的 SQL 误判成“慢 SQL”[^23]。`avg_gets`（平均逻辑读）高，说明扫描的数据块多，优先看索引和过滤条件。`ALLSTATS LAST` 能显示真实行数（A-Rows），前提是收集了执行统计[^24]。

```sql
-- 会话级打开统计收集
ALTER SESSION SET statistics_level = ALL;
```

---

#统计信息
--
```sql
BEGIN
  DBMS_STATS.GATHER_TABLE_STATS(
    ownname          => 'SCOTT',
    tabname          => 'EMP',
    cascade          => TRUE,
    degree           => 4,
    estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE);
END;
/

-- 查看统计信息新鲜度
SELECT table_name, last_analyzed, num_rows, stale_stats
FROM   dba_tab_statistics
WHERE  owner = 'SCOTT';
```

统计信息过期会让 CBO 估算错行数，进而选错连接方式和索引[^25]。`cascade => TRUE` 会同时收集表上索引的统计；`degree` 控制并行度。收集会消耗 IO 和 CPU，避免在业务高峰做；分区表大表可用 `INCREMENTAL => TRUE` 只收集变化分区[^26]。

---

#索引维护
--
```sql
-- 查找失效索引
SELECT index_name, table_name, status
FROM   dba_indexes
WHERE  owner = 'SCOTT'
AND    status = 'UNUSABLE';

-- 在线重建，减少锁表
ALTER INDEX scott.idx_emp_dept REBUILD ONLINE;

-- 开启使用监控
ALTER INDEX scott.idx_emp_dept MONITORING USAGE;
SELECT index_name, used FROM v$object_usage;
```

索引变 `UNUSABLE` 常见于分区表 `DROP/TRUNCATE PARTITION` 未加 `UPDATE GLOBAL INDEXES`、直接路径加载失败等[^27]。`REBUILD ONLINE` 期间仍可 DML，但会占用大量 TEMP 和 UNDO。长期不用的索引可以通过 `MONITORING USAGE` 找出来再评估删除[^28]。

---

#用户与权限
--
```sql
CREATE USER app IDENTIFIED BY "P@ssw0rd"
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA 500M ON users;

GRANT CONNECT, RESOURCE TO app;
GRANT SELECT ON scott.emp TO app;

-- 账号状态与密码过期
SELECT username, account_status, expiry_date FROM dba_users;

ALTER USER app ACCOUNT UNLOCK;
```

`RESOURCE` 角色在 11g 里包含 `UNLIMITED TABLESPACE`，等于给了无限空间权限，生产应回收[^29]。11g 起默认 profile 的 `PASSWORD_LIFE_TIME` 是 180 天，密码过期会导致应用连不上，表现为 `ORA-28001`[^30]。

```sql
-- 单独建 profile，避免影响所有用户
CREATE PROFILE app_prof LIMIT
  PASSWORD_LIFE_TIME        90
  FAILED_LOGIN_ATTEMPTS      5
  PASSWORD_LOCK_TIME         1;
ALTER USER app PROFILE app_prof;

-- 回收无限表空间
REVOKE UNLIMITED TABLESPACE FROM app;
```

---

#内存与连接数
--
```sql
SHOW PARAMETER sga_target;
SHOW PARAMETER pga_aggregate_target;
SHOW PARAMETER processes;
SHOW PARAMETER sessions;

SELECT name, value, isdefault
FROM   v$parameter
WHERE  name IN ('sga_target','pga_aggregate_target','processes','sessions');
```

SGA 是共享内存（buffer cache、shared pool、redo log buffer），PGA 是每进程私有内存（排序、哈希）[^31]。`processes` 不够时新连接报 `ORA-00020`，`sessions` 通常按 `processes * 1.1 + 5` 自动推导[^32]。

```sql
ALTER SYSTEM SET processes = 500 SCOPE = SPFILE;
-- 重启后生效

SELECT COUNT(*) FROM v$session;   -- 当前会话数
SELECT resource_name, current_utilization, limit_value
FROM   v$resource_limit
WHERE  resource_name IN ('processes','sessions');
```

---

#备份与数据泵
--
RMAN 全备（需归档模式才能做一致热备）：

```sql
RMAN> BACKUP DATABASE PLUS ARCHIVELOG;
RMAN> LIST BACKUP SUMMARY;
RMAN> VALIDATE DATABASE;
```

数据泵导出/导入：

```sql
-- 目录对象必须指向数据库服务器上的路径
CREATE OR REPLACE DIRECTORY dpdir AS '/u01/dump';
GRANT READ, WRITE ON DIRECTORY dpdir TO system;

-- 导出（参数写在一行，Windows 下换行需用 ^ 续行）
expdp system/pwd@orcl schemas=scott directory=dpdir dumpfile=scott_%U.dmp logfile=scott_exp.log parallel=2

-- 导入（目标用户需先存在）
impdp system/pwd@orcl schemas=scott directory=dpdir dumpfile=scott_%U.dmp logfile=scott_imp.log remap_schema=scott:scott_new
```

`expdp/impdp` 是服务端程序，dump 文件写在数据库服务器上，不是客户端[^33]。`%U` 配合 `parallel` 生成多个文件，导入时也要带 `%U`。`remap_schema` 要求目标用户已创建并有配额，否则导入报错[^34]。

---

#大对象与空间
--
```sql
SELECT * FROM (
  SELECT owner, segment_name, segment_type,
         ROUND(bytes / 1024 / 1024, 2) AS mb
  FROM   dba_segments
  WHERE  owner NOT IN ('SYS', 'SYSTEM')
  ORDER  BY bytes DESC
) WHERE ROWNUM <= 20;
```

回收站里的对象也占空间，名字以 `BIN$` 开头：

```sql
SHOW RECYCLEBIN;
PURGE RECYCLEBIN;                      -- 清空当前用户回收站
PURGE TABLE "BIN$xxxxx";               -- 清指定对象
```

`dba_segments` 按段统计，能看到表、索引、`LOBSEGMENT`、分区子段[^35]。`DROP TABLE` 默认进回收站，空间不会立即释放；生产删大表建议 `DROP TABLE ... PURGE` 直接释放[^36]。

---

#参数与告警日志
--
```sql
SHOW PARAMETER db_recovery_file_dest_size;

ALTER SYSTEM SET processes = 500 SCOPE = SPFILE;
ALTER SYSTEM SET open_cursors = 1000 SCOPE = BOTH;
```

`SCOPE` 三个取值：`MEMORY` 立即生效但重启丢失、`SPFILE` 只改参数文件需重启、`BOTH` 两者都改[^37]。静态参数（如 `processes`、`sga_max_size`）只能改 `SPFILE` 并重启。

告警日志位置：

```sql
SELECT value FROM v$diag_info WHERE name = 'Diag Trace';
```

11g 以后日志由 ADR 统一管理，告警日志就在上面查到的 trace 目录下，文件名是 `alert_<sid>.log`，完整路径一般是 `$ORACLE_BASE/diag/rdbms/<db_unique_name>/<sid>/trace/alert_<sid>.log`[^38]。排查 ORA 错误、实例崩溃、归档卡住，第一站都是它。

---

#作业调度
--
```sql
-- 老式 DBMS_JOB
SELECT job, log_user, what, next_date, broken FROM dba_jobs;

-- 12c 推荐 DBMS_SCHEDULER
SELECT job_name, enabled, state, last_start_date, next_run_date
FROM   dba_scheduler_jobs;
```

```sql
BEGIN
  DBMS_SCHEDULER.CREATE_JOB(
    job_name        => 'JOB_STAT',
    job_type        => 'PLSQL_BLOCK',
    job_action      => 'BEGIN DBMS_STATS.GATHER_SCHEMA_STATS(''SCOTT''); END;',
    start_date      => SYSTIMESTAMP,
    repeat_interval => 'FREQ=DAILY; BYHOUR=2; BYMINUTE=0',
    enabled         => TRUE);
END;
/
```

`DBMS_JOB` 功能有限，12c 起官方推荐 `DBMS_SCHEDULER`[^39]。`repeat_interval` 用日历表达式，比 `DBMS_JOB` 的 `next_date` 直观；`state` 为 `BROKEN` 时作业不会执行，需要排查失败原因后重新启用。

---

#注脚
--

[^1]: `DBA_*` 静态字典存在数据文件里，`V$*` 动态性能视图来自 SGA 内存，实例重启后重新生成。

[^2]: RAC 多实例环境用 `GV$*`，等价于在所有实例的 `V$*` 上做 UNION，多一个 `INST_ID` 列。

[^3]: `NOMOUNT` 读参数文件、启动后台进程；`MOUNT` 读控制文件；`OPEN` 打开数据文件。开归档、恢复控制文件在 MOUNT 做。

[^4]: `SHUTDOWN ABORT` 不做 checkpoint，等同于断电，下次启动由 SMON 做实例恢复（前滚 + 回滚）。

[^5]: 已分配大小减去空闲 extent 才是已用。只查 `dba_free_space` 会漏掉自动扩展带来的新增空间。

[^6]: 临时表空间的数据文件记录在 `dba_temp_files` / `v$tempfile`，不在 `dba_data_files`。

[^7]: `ORA-03297: file contains used data beyond requested RESIZE value`，说明缩得比高水位还小。

[^8]: `MAXSIZE UNLIMITED` 会让数据文件一直涨到文件系统满，建议设上限并对表空间使用率做告警。

[^9]: 临时段只在排序/哈希等操作期间存在，用完即释放，不写 redo，但崩溃后无法恢复其中的数据。

[^10]: `ORA-01652` 先扩容 TEMP 让业务恢复，再查 `v$tempseg_usage` 找消耗最大的 SQL 优化。

[^11]: `ORA-01555` 的根因是 undo 被覆盖，常见于长查询 + 频繁 DML，解决方向是调大 UNDO 或缩短查询/分批提交。

[^12]: UNDO 空间不足报 `ORA-30036: unable to extend segment by ... in undo tablespace`。

[^13]: 归档模式保留所有日志切换后的重做，才能做热备和 `RECOVER DATABASE UNTIL TIME`。

[^14]: FRA 满时 `ARCH` 进程无法归档，所有 DML 挂起，告警日志出现 `ORACLE instance stuck` / `Archiver error`。

[^15]: `CURRENT` 正在写；`ACTIVE` 已切换但 checkpoint 未完成，崩溃恢复需要它；`INACTIVE` 可被覆盖；`UNUSED` 从未使用。

[^16]: 多路复用（一组多个成员）防止单块磁盘损坏导致日志丢失；成员应放在不同物理磁盘。

[^17]: `KILL SESSION` 后 `v$session.status` 变为 `KILLED`，PMON 回滚完事务才删除会话。

[^18]: OS 层 `kill -9` 后 Oracle 可能仍认为会话存在，需再 `KILL SESSION` 或用 `orakill`（Windows）清理。

[^19]: `TM` 表级锁的 `ID1` 是对象 ID；`TX` 事务锁的 `ID1/ID2` 是 undo 段号和槽号，不是对象。

[^20]: 外键列没索引时，父表删除/更新会锁全表（`TM` 锁），是常见的“删一条卡全表”原因。

[^21]: 等待事件分 `wait_class`，排障先看非 `Idle` 类；`Idle` 类（如 `SQL*Net message from client`）是客户端空闲，不用管。

[^22]: 10g 起 `v$session_wait` 被 `v$session` 的 `event`、`wait_class`、`seconds_in_wait` 等列取代。

[^23]: `elapsed_time` 是累计值，执行上百万次的短 SQL 也会排前面；应结合 `avg_sec` 和 `avg_gets` 判断。

[^24]: `ALLSTATS LAST` 依赖游标级的行源统计，需 `statistics_level=ALL` 或 `/*+ gather_plan_statistics */`，否则 A-Rows 显示为空。

[^25]: CBO 依据统计信息估算基数（Cardinality），估算偏差大就会选错 nested loop / hash join 和索引。

[^26]: 分区表开启 `INCREMENTAL` 后，只收集有变化的分区，配合 `STALE_STATS` 判断是否需要收集。

[^27]: 分区维护导致全局索引失效时，加 `UPDATE GLOBAL INDEXES` 可避免重建；否则只能 `REBUILD`。

[^28]: `V$OBJECT_USAGE` 只记录开启监控之后是否被使用过，统计周期要覆盖完整业务周期（如一个月）才有参考价值。

[^29]: `RESOURCE` 角色在 11g 含 `UNLIMITED TABLESPACE`；12c 起该角色不再自动包含，但仍建议显式 `REVOKE` 并按需给 `QUOTA`。

[^30]: `ORA-28001: the password has expired`，改 `PASSWORD_LIFE_TIME` 后已过期用户仍需 `ALTER USER ... IDENTIFIED BY` 重置。

[^31]: SGA = buffer cache + shared pool + redo log buffer + large pool 等；PGA = sort/hash area + session 私有内存。

[^32]: `sessions = (1.1 * processes) + 5` 是 Oracle 的推导公式，改 `processes` 后 `sessions` 会自动跟着变。

[^33]: `expdp/impdp` 是服务端工具，`DIRECTORY` 对象指向数据库服务器路径；客户端执行只是发命令，文件落不到本地。

[^34]: `remap_schema` 只改对象归属，不会建用户；目标用户不存在或没有配额时导入会失败，需先 `CREATE USER` 并按需授权。

[^35]: `dba_segments` 一个分区是一个独立段；`LOBSEGMENT` 存 LOB 数据，`LOBINDEX` 存 LOB 定位索引。

[^36]: `DROP TABLE ... PURGE` 跳过回收站直接释放空间；普通 `DROP` 可用 `FLASHBACK TABLE` 找回。

[^37]: `SCOPE=MEMORY` 立即生效、重启失效；`SPFILE` 只写参数文件、重启生效；`BOTH` 两者都改。

[^38]: 用 `v$diag_info` 查路径最可靠，不同版本/安装方式（ASM、RAC）目录结构可能不同。

[^39]: `DBMS_SCHEDULER` 支持链、窗口、资源管理器、远程作业，功能远超 `DBMS_JOB`；12c 起 `DBMS_JOB` 仅作兼容保留。
