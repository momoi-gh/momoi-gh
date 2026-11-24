# 历史指令
```
history | fzf 
```

`c^z  jobs -1 bg后台 fg %1 前台`
# 用户查询
```
who        # 当前登录的用户及终端、登录时间
w          # 更详细，含负载、正在执行的命令
users      # 只列用户名
whoami     # 当前有效用户名
id         # 当前用户的 UID/GID/所属组
getent  group 
		passwd
cat /etc/passwd
```

# 详细信息
```
id username          # UID、GID、所属组
groups username      # 所属组
getent passwd username
finger username      # 需安装 finger 包
```

|权限|文件含义|目录含义|
|---|---|---|
|`r` 读 (4)|读取内容|列出目录内容（`ls`）|
|`w` 写 (2)|修改内容|在目录内创建/删除/重命名文件|
|`x` 执行 (1)|作为程序执行|进入目录（`cd`）、访问其中的文件|
-  rwx  r-x  r--\
   u    g    o
# #权限

```权限
chmod 755 file        # rwxr-xr-x
chmod 644 file        # rw-r--r--
chmod 600 secret      # rw-------
chmod 4755 prog       # SUID + 755
chmod 1777 /tmp       # Sticky + 777


chmod u+x script.sh          # 属主加执行
chmod g-w,o-r file           # 属组去写，其他去读
chmod a+r file               # 所有人加读
chmod u=rwx,g=rx,o= file     # 精确定义
chmod -R g+rwx dir           # 递归
```
# #归属

```归属
chown alice file              # 改属主
chown alice:devs file         # 同时改属主和属组
chown :devs file              # 只改属组（等价 chgrp devs file）
chown -R alice:devs dir       # 递归
chgrp devs file               # 只改属组
```