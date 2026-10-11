# VPS 完整部署

线上地址：https://society-lab.wei67.top

```powershell
python deploy/vps_exec.py "F:\Codex_Project\vps迁移\.vps_exec.py" deploy/bootstrap.sh
python deploy/vps_exec.py "F:\Codex_Project\vps迁移\.vps_exec.py" deploy/verify.sh
```

脚本拉取 GitHub main，通过 `uv sync --frozen --no-dev` 安装全部 Python 依赖，使用服务器 Node.js 构建前端，安装 systemd 服务，复用已有 Caddy 提供 HTTPS、静态文件和 API 反向代理。首次修改 Caddy 主配置前保留备份。

- 代码：`/opt/society-lab`
- Python 3.12 与 uv：`/opt/society-lab-tools`
- 服务：`society-lab`，非 root 运行、开机自启
- API：`127.0.0.1:8012`
- Caddy：`/etc/caddy/sites/society-lab.caddy`
- 模型配置：`/var/lib/society-lab/.env`（服务账号私有，不进入 Git）
- 新运行：`/var/lib/society-lab/runs`（更新代码时保留）
- 日志：`journalctl -u society-lab -n 100 --no-pager`

全功能开放，无管理员登录。首次部署不迁移本机模型密钥，在页面填写 API Key、API Base、Model 后保存即可新建实验。已有 6 个 LLM 博弈与 12 个离线归档始终可浏览，无需模型配置。

`StateDirectory` 提供独立可写状态目录，代码与依赖保持只读。后端可通过 `SOCIETY_LAB_ENV_FILE`、`SOCIETY_LAB_RUNS_DIR` 自定义状态路径；`SOCIETY_LAB_INCLUDE_ARCHIVE=1` 包含离线历史。仍可设置 `SOCIETY_LAB_READ_ONLY=1` 切换为只读模式。

再次运行 bootstrap 更新代码与依赖，不覆盖已保存模型参数和新运行数据。服务器需已有 Git、curl、Node.js/npm、Caddy 和 systemd，域名指向该服务器。
