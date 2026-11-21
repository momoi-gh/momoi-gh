[[index]]

#CREATE
--
```sql
 创建部门表
CREATE TABLE dept (
    deptno NUMBER(2) PRIMARY KEY,
    dname  VARCHAR2(20) NOT NULL,
    loc    VARCHAR2(20)
);
创建员工表，并设置外键
CREATE TABLE emp (
    empno    NUMBER(4) PRIMARY KEY,
    ename    VARCHAR2(20) NOT NULL,
    job      VARCHAR2(20),
    mgr      NUMBER(4),
    hiredate DATE,
    sal      NUMBER(7,2),
    comm     NUMBER(7,2),
    deptno   NUMBER(2),
    CONSTRAINT fk_emp_dept FOREIGN KEY (deptno) REFERENCES dept(deptno)
);
```


---
#INSERT
--
```sql

INSERT INTO dept (deptno, dname, loc) VALUES (10, 'ACCOUNTING', 'NEW YORK');
INSERT INTO dept (deptno, dname, loc) VALUES (20, 'RESEARCH',   'DALLAS');
INSERT INTO dept (deptno, dname, loc) VALUES (30, 'SALES',      'CHICAGO');

INSERT INTO emp (empno, ename, job, mgr, hiredate, sal, comm, deptno)
VALUES (7369, 'SMITH', 'CLERK', 7902, DATE '1980-12-17', 800, NULL, 20);

INSERT INTO emp (empno, ename, job, mgr, hiredate, sal, comm, deptno)
VALUES (7499, 'ALLEN', 'SALESMAN', 7698, DATE '1981-02-20', 1600, 300, 30);

INSERT INTO emp (empno, ename, job, mgr, hiredate, sal, comm, deptno)
VALUES (7839, 'KING', 'PRESIDENT', NULL, DATE '1981-11-17', 5000, NULL, 10);

COMMIT;
```
---
#DELETE
--
```sql
-- 删除员工编号为 7369 的记录
DELETE FROM emp
WHERE empno = 7369;

COMMIT;
```
---

#JOIN
--

```sql
SELECT e.ename, d.dname
FROM emp e
JOIN dept d ON e.deptno = d.deptno;
join 添加 on 限定
```

---

#LEFT，full
--
|              |                        |
| ------------ | ---------------------- |
| `INNER JOIN` | 只保留两边都匹配的行             |
| `LEFT JOIN`  | 保留左表全部行，右表匹配不上补 `NULL` |
| `RIGHT JOIN` | 保留右表全部行，左表匹配不上补 `NULL` |
| `FULL JOIN`  | 两边全部保留，匹配不上补 `NULL`    |

---

#聚合函数
--

SELECT deptno, AVG(sal) AS avg_sal, MAX(sal) AS max_sal, MIN(sal) AS min_sal
FROM emp
GROUP BY deptno
HAVING AVG(sal) > 2000;



---

#子查询：EXISTS
--

查询有员工的部门：

sql

SELECT d.dname
FROM dept d
WHERE EXISTS (
    SELECT 1
    FROM emp e
    WHERE e.deptno = d.deptno
);

### 3.7 子查询：相关子查询

查询工资高于本部门平均工资的员工：

sql

SELECT e.ename, e.sal, e.deptno
FROM emp e
WHERE e.sal > (
    SELECT AVG(sal)
    FROM emp
    WHERE deptno = e.deptno
);
#IN子查询
--
SELECT ename, deptno
FROM emp
WHERE deptno IN (
    SELECT deptno
    FROM dept
    WHERE loc = 'NEW YORK'
);

---

#标量子查询
--
SELECT ename,
       sal,
       (SELECT AVG(sal) FROM emp) AS avg_all_sal
FROM emp;

---

#ALTER/DROP
--
### ALTER：增加列**ADD**


```sql
ALTER TABLE emp ADD (email VARCHAR2(50));
```

### ALTER：修改列类型**MODIFY**

```sql

ALTER TABLE emp MODIFY (job VARCHAR2(30));
```

### ALTER：删除列**DROP**



```sql
ALTER TABLE emp DROP COLUMN email;
```

### DROP：删除表



```sql
-- 先删有外键的员工表，再删部门表
DROP TABLE emp;
DROP TABLE dept;
```