[[pgsql]]
`/var/lib/postgresql/18/docker/pg_wal`

```sql
#wal_lsn号
select pg_current_wal_lsn();
lsn 查询wal地址
select pg_walfile_name();
```

# vi postgresql.conf
```
#打开wal日志
wal_level = replica

fsync = on
```
# 归档archive
```
archive_mod = on 
archive_command = 'test ! -f /mnt/server/archivedir/%f && cp %p /mnt/server/archivedir/%f' # 这是默认

'test ! -f /archive/%f && cp %p /archive/%f'
mkdir  /archive
chown -R postgres. archive

```

```pg_basebackup
pg_hba.conf#查看权限

#Ft格式.tar
#pv详细信息 
#R复制写配置文件
pg_basebackup -D /pg_basebackup -Ft -Pv -U postgres -R
		结果 base.tar  pg_wal.tar 41008.tar 41015.tar
```

```
tar -xf base.tar -C  /var/lib/postgresql/18/docker/pg_wal
tar -xf pg_wal.tar -C  /var/lib/postgresql/18/docker/pg_wal

#编写postgresql.auto.conf
restore_command = 'cp /archive%f %p'
recovery_target = 'immediate'
select pg_wal_replay_resume();
```