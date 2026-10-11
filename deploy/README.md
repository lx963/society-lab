# VPS 只读展示部署

线上地址：https://society-lab.wei67.top

通过用户提供的 `.vps_exec.py` SSH 辅助脚本执行部署：

```powershell
python deploy/vps_exec.py "F:\Codex_Project\vps迁移\.vps_exec.py" deploy/bootstrap.sh
```

部署脚本从 GitHub main 获取代码，安装独立 Python 3.12 环境和展示所需 API 依赖，使用服务器已有 Node.js 构建前端。它安装 `society-lab.service` 并向已有 Caddy 配置添加独立站点文件，自动申请 HTTPS 证书。首次更改 Caddy 主配置前会保留备份。

- 应用目录：`/opt/society-lab`
- systemd 服务：`society-lab`，非 root 账号运行，开机自启
- API：仅监听 `127.0.0.1:8012`
- Caddy 站点：`/etc/caddy/sites/society-lab.caddy`
- 日志：`journalctl -u society-lab -n 100 --no-pager`

`SOCIETY_LAB_READ_ONLY=1` 同时关闭 API 模型配置与新建实验，并让页面展示 6 个真实 LLM 博弈与 12 个离线归档。API 不返回模型连接信息。Caddy 额外拒绝 POST、PUT、PATCH、DELETE。模型密钥不会从本机迁移到服务器。

展示服务无需安装 AgentSociety 的模型运行依赖。若需要恢复本地完整交互模式，按根目录 README 使用 `uv sync --frozen`，不设置 `SOCIETY_LAB_READ_ONLY`。不要在当前只读 Python 环境中直接启用模型执行。

更新代码后再次执行上述命令。脚本要求服务器已安装 Git、curl、Node.js/npm、Caddy、systemd，并且域名指向该服务器。复用既有端口 80/443 的 Caddy，不占用其他应用后端端口。
