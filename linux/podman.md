启动 / 关闭
podman start bs-postgres     # 启动\
podman stop bs-postgres      # 停止（数据保留）\
podman restart bs-postgres   # 重启\
podman rm -f bs-postgres     # 删除容器（数据仍在卷 bs_pgdata 里）

查看状态\
podman ps                    # 运行中的容器\
podman ps -a                 # 所有容器（含已停止）\
podman logs -f bs-postgres   # 实时日志，Ctrl+C 退出\
podman inspect bs-postgres --format '{{.State.Health.Status}}'\
podman port bs-postgres      # 端口映射\
[[SQL/psql/pgsql]]