# Tracero 前后端接口约定

## 运行模式

前端继续使用原有架构，通过 `.env.local` 切换 Mock/后端模式：

```env
VITE_TRACERO_USE_MOCK=false
VITE_TRACERO_API_BASE_URL=http://127.0.0.1:8000
VITE_TRACERO_REASONING_PATH=/api/reason
VITE_TRACERO_RUNS_PATH=/api/runs
```

后端通过独立环境变量选择证据来源：

```env
TRACERO_DATA_PROVIDER=demo
```

- `demo`：使用后端 `DemoEvidenceProvider`。
- `robot`：使用 `RobotEvidenceProvider`；真实数据源未配置时返回 `PROVIDER_UNAVAILABLE`，不会静默回退 Demo。

## 业务推理

```http
POST /api/reason
```

前端只发送事件条件，不发送 `evidence`：

```json
{
  "trigger_type": "navigation_failed",
  "robot": "robot_001",
  "occurred_at": "2026-08-01T09:00:00+08:00",
  "context_window_seconds": 5
}
```

用户提问可增加：

```json
{
  "trigger_type": "user_question",
  "robot": "robot_001",
  "occurred_at": "2026-08-01T09:00:00+08:00",
  "context_window_seconds": 300,
  "question": "机器人刚才为什么左右摇摆？"
}
```

成功响应直接包含结构化 `conclusion`：

```json
{
  "run_id": "run-abcd1234",
  "trigger_type": "navigation_failed",
  "event_type": "导航失败",
  "evidence_type": "navigation_failed",
  "provider_type": "demo",
  "data_source": "demo",
  "robot": "robot_001",
  "occurred_at": "2026-08-01T09:00:00+08:00",
  "status": "completed",
  "verified": true,
  "conclusion": {
    "fact": "……[E-01]",
    "reasoning": "……[E-02]",
    "suggestion": "……[E-04]"
  },
  "evidence": [],
  "errors": [],
  "error_code": null,
  "valid_evidence_ids": ["E-01", "E-02", "E-04"],
  "created_at": "2026-08-01T01:00:03+00:00"
}
```

前端直接使用 `conclusion`，不再解析 `output`。

## 证据直传调试接口

保留原接口：

```http
POST /api/debug/reason
```

它用于上游已经拥有完整证据的调试或 Agent 推送场景：

```json
{
  "evidence_type": "navigation_failed",
  "evidence": [
    {
      "evidence_id": "E-01",
      "type": "metric",
      "content": "costmap 更新时间差超过阈值"
    }
  ]
}
```

为兼容旧调用，直传证据未提供 `occurred_at` 时，后端会补充接收时间。

## 历史记录

```http
GET /api/runs
GET /api/runs/{run_id}
```

旧 SQLite 记录会保留。后端启动时只增加缺失列，不会删除 `tracero.db`。旧记录缺少的新字段会以 `legacy` 或兼容默认值返回。

## 错误码

```text
PROVIDER_UNAVAILABLE
EVIDENCE_NOT_FOUND
MODEL_REQUEST_FAILED
OUTPUT_VERIFICATION_FAILED
DATABASE_WRITE_FAILED
```

前端会展示后端返回的具体错误码和说明，不再统一隐藏成“TC-01 推送失败”。

## 当前富结构边界

后端当前提供真实的证据、结构化结论、数据来源和推理记录。`timeline / developerAnalysis / testAnalysis / opsAnalysis` 尚未由后端生成，现阶段仍由前端 Mock 补齐，并在页面标注“富结构为示例”。
