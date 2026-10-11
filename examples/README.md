# 已完成实例目录

收录现有 18 个已完成历史运行（2026-09-26），保留原始输入、事件、技能及已有回放文件。6 个 LLM 博弈运行可通过当前页面的“最近运行”查看；12 个离线示例仅作历史归档。离线记录中的 llm_steps 是早期元数据，不表示实际模型调用。

LLM 记录位于 `data/runs/`；归档位于 `examples/offline/`。每条记录的 `mode`、`status`、`model` 和 `events` 可用于核查。存在 `replay/` 时可直接检查 JSONL 回放；部分早期离线实例没有独立回放文件。

| 示例 | 执行模式 | 模型 | 事件数 | 原始结果 |
| --- | --- | --- | --- | --- |
| custom_env | offline | — | 5 | [02ae3fc915f8497bad04475c0ad10094](offline/02ae3fc915f8497bad04475c0ad10094/result.json) |
| hello_agent | offline | — | 6 | [06a6c5a48af24d79bc5ff10dceb03013](offline/06a6c5a48af24d79bc5ff10dceb03013/result.json) |
| hello_agent | offline | — | 6 | [1ff6fa15a4c4484b964e51691ef76606](offline/1ff6fa15a4c4484b964e51691ef76606/result.json) |
| replay_system | offline | — | 5 | [34685feda4b94aeca2f36167b0a85001](offline/34685feda4b94aeca2f36167b0a85001/result.json) |
| replay_system | offline | — | 5 | [5058870a8e7d46e69bf00db6a7d316f6](offline/5058870a8e7d46e69bf00db6a7d316f6/result.json) |
| hello_agent | offline | — | 6 | [5b3943f2dc294fc8901ae1ecfcdf2cfe](offline/5b3943f2dc294fc8901ae1ecfcdf2cfe/result.json) |
| prisoners_dilemma | llm | gpt-5.6-luna | 4 | [8c2964df44c24a028a71ace95e0a0d9a](../data/runs/8c2964df44c24a028a71ace95e0a0d9a/result.json) |
| replay_system | offline | — | 5 | [a0b3d31387e54855a65633a01c9ec10b](offline/a0b3d31387e54855a65633a01c9ec10b/result.json) |
| custom_env | offline | — | 7 | [acea2c105e8e4803be385647a8110404](offline/acea2c105e8e4803be385647a8110404/result.json) |
| replay_system | offline | — | 5 | [af39a56da4114a4b9c2d76124f12f246](offline/af39a56da4114a4b9c2d76124f12f246/result.json) |
| prisoners_dilemma | llm | gpt-5.6-luna | 4 | [b8302e76d1ad4365a14065318ef2feee](../data/runs/b8302e76d1ad4365a14065318ef2feee/result.json) |
| custom_env | offline | — | 7 | [b914b29e3c2b442282d3331bac0e071d](offline/b914b29e3c2b442282d3331bac0e071d/result.json) |
| prisoners_dilemma | llm | gpt-5.6-luna | 4 | [bbbbbcd7c36744c5994b9b5472a03f1f](../data/runs/bbbbbcd7c36744c5994b9b5472a03f1f/result.json) |
| reputation_game | llm | gpt-5.6-luna | 72 | [c00e94cadd3143619263c1c03143ce7f](../data/runs/c00e94cadd3143619263c1c03143ce7f/result.json) |
| public_goods | llm | gpt-5.6-luna | 15 | [d6ebfda464c44b21aeb3735f6df51791](../data/runs/d6ebfda464c44b21aeb3735f6df51791/result.json) |
| custom_env | offline | — | 7 | [decc18dab09e47eeab5bb433bbff14dd](offline/decc18dab09e47eeab5bb433bbff14dd/result.json) |
| prisoners_dilemma | llm | gpt-5.6-luna | 4 | [eef6ab43e560457185ad7561aa634d4e](../data/runs/eef6ab43e560457185ad7561aa634d4e/result.json) |
| replay_system | offline | — | 5 | [f50f1a30ae5645409d53ed27c8861391](offline/f50f1a30ae5645409d53ed27c8861391/result.json) |
