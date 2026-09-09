# Tracero 前端真实推理链路进展

> 当前目标：先完成一条稳定、可验证的真实链路，不考虑自动告警与用户提问并行。

## 1. 当前目标

本阶段只关注一个场景：

```text
小车遇到障碍物
      ↓
Agent 采集并上报事件
      ↓
后端接收事件并创建 run
      ↓
后端构建证据、调用模型并校验结果
      ↓
前端自动获取最新 Agent run
      ↓
展示真实推理过程、结论和证据
```

前端不再创建用户提问事件，不在多个 run 之间并行切换，也暂不提供事件内继续追问。

## 2. Provider 的职责

`TraceroProvider` 已收敛为当前 Agent 推理任务的观察器：

- 页面打开后请求后端最新 Agent run。
- 没有 Agent run 时显示等待状态。
- 每 2 秒静默刷新一次。
- 新事件到达后自动显示该 run。
- 同一个 run 从 `received/reasoning` 进入 `done/failed` 时自动更新。
- 请求异常时展示真实错误，不使用 Mock 数据兜底。

Provider 不再处理用户提问参数、pending 问题记录、历史 run 切换或前端模拟推理。

## 3. 前后端接口链路

Agent 应将障碍事件提交到：

```http
POST /api/ingest/event
Content-Type: application/json
```

请求体遵循后端 `EventIngestRequest`：

```json
{
  "event_type": "obstacle_detected",
  "trigger_time": 1787450000.0,
  "robot_id": "robot_001",
  "window": {
    "before": [],
    "at": [
      {
        "topic": "/scan",
        "timestamp": 1787450000.0,
        "data": {
          "min_range": 0.28
        }
      }
    ],
    "after": []
  },
  "params_snapshot": {},
  "static_index_version": null
}
```

后端收到事件后返回：

```json
{
  "run_id": "run-xxxxxxxx",
  "status": "received",
  "created_at": "..."
}
```

前端使用以下接口读取结果：

| 能力 | 接口 |
| --- | --- |
| 获取 run 列表 | `GET /api/runs` |
| 获取最新 Agent run 详情 | `GET /api/runs/{run_id}` |

后端列表按 `created_at DESC` 排序。前端会忽略 `user_question` 和 `follow_up_question`，选择最新的 Agent run。

## 4. 真实结果如何显示

后端 run 详情中的字段会映射到前端：

| 后端字段 | 前端展示 |
| --- | --- |
| `run_id` | 当前任务编号 |
| `evidence_type` | 事件类型 |
| `robot_id` | 小车编号 |
| `status` / `progress` | 推理状态和进度 |
| `raw_event` | 推理过程的事件节点 |
| `evidence` | Agent 证据栏 |
| `output` | 事实、推理、建议 |
| `verified` | 是否允许作为正式结果展示 |
| `errors` | 失败原因 |

只有 `verified=true` 且 `output` 非空时，前端才将结果标记为正式后端结论。

模型输出需要包含：

```text
【事实】...
【推理】...
【建议】...
```

前端同时兼容带 Markdown 加粗的标题和普通的“事实：”格式。

## 5. 页面结构

当前推理页分为三栏：

1. **推理过程**：展示后端 timeline，或由原始事件和证据生成时间线。
2. **推理结果**：展示后端真实的事实、推理和建议。
3. **Agent 证据**：展示 evidence ID、标题、来源、原始片段和影响说明。

推理尚未完成时，页面显示当前 progress 和已形成的证据，不会提前显示“推理结果生成”。

## 6. 当前验证结果

- `VITE_TRACERO_USE_MOCK=false`，本地已关闭 Mock。
- TypeScript 和 Vite 生产构建通过。
- API、时间线和历史测试已调整为障碍 Agent 场景。
- 当前配置的线上后端 `http://139.224.113.124` 健康检查正常。
- 线上 `/api/runs` 当前有 1803 条记录：
  - `user_question`：1802 条
  - `follow_up_question`：1 条
  - 障碍或导航类 Agent run：0 条

因此当前前端会显示“等待 Agent 上报障碍事件”。这不是前端解析失败，而是该后端目前没有收到可展示的 Agent run。

## 7. 下一步联调检查

1. 确认小车 Agent 的目标地址是 `http://139.224.113.124/api/ingest/event`。
2. 确认请求方法为 POST，且 `Content-Type: application/json`。
3. 确认 `event_type` 不是 `user_question` 或 `follow_up_question`。
4. 上报后检查响应中是否取得 `run_id`。
5. 使用 `GET /api/runs/{run_id}` 检查状态是否从 `received/reasoning` 进入 `done`。
6. 确认最终详情中 `verified=true`、`output` 非空并包含事实、推理和建议。
7. 打开前端当前推理页，结果应在最多约 2 秒后自动更新。

## 8. 分享时可直接使用的总结

这轮前端工作已经从双线并行方案收敛为一条真实 Agent 链路。Provider 只负责观察后端最新的小车事件，每两秒刷新 run 状态；事件到达后，页面依次展示处理进度、真实模型结论和 Agent 证据，不再使用用户提问 run、并行事件切换或未打通的 Chat。

当前前端生产构建已经通过，真实模式也已开启。现在的阻塞点在数据入口：当前线上后端只有用户提问记录，还没有收到障碍 Agent run。只要 Agent 将障碍事件成功发送到同一后端的 `/api/ingest/event`，并生成经过校验的 output，前端就会自动显示真实推理结果。
