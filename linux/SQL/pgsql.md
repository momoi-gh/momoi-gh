\l        -- 列出数据库\
\dt       -- 列出表\
\d 表名    -- 表结构\
\q        -- 退出\
#cmd\
podman exec -it bs-postgres psql -U bs -d bs_chat


podman volume inspect bs_pgdata --format '{{.Mountpoint}}'

host=127.0.0.1  port=5432  user=bs  password=bs_dev_password  db=bs_chat\
DATABASE_URL=postgres://bs:bs_dev_password@127.0.0.1:5432/bs_chat