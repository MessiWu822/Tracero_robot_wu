# Tracero Agent 多轮推理结果实施说明

## 目标

实现以下链路：

```text
Gazebo / 真实机器人
    -> ROS Agent 检测异常
    -> POST /api/ingest/event
    -> 后端构建初始证据
    -> DeepSeek Agent loop
    -> 每轮工具调用后保存 reasoning_rounds
    -> /api/runs/{run_id} 返回已完成轮次
    -> 前端轮询并逐个显示轮次
```

前端显示的轮次必须来自后端 `reasoning_rounds`，不能根据 `timeline` 或固定文案生成。

## 一轮的定义

一轮等于一次 DeepSeek assistant 响应、该响应中的全部 `tool_calls`，以及这些工具调用返回的新证据。

一次响应包含多个工具调用时，仍然只算一轮。没有工具调用的响应单独保存为“最终结论”轮。

DeepSeek API 不会返回隐藏 chain-of-thought。只能保存 `assistant.content`、工具名称、工具结果和新证据。`assistant.content` 为空时使用固定的证据推理摘要，不能声称这是模型隐藏思维链。

## 数据库迁移

新建 `runs` 表时增加：

```sql
reasoning_rounds_json TEXT NOT NULL DEFAULT '[]'
```

已有数据库在启动初始化阶段迁移，不要在请求处理过程中执行：

```python
def ensure_runs_columns(connection):
    columns = {
        row["name"]
        for row in connection.execute("PRAGMA table_info(runs)")
    }

    if "reasoning_rounds_json" not in columns:
        connection.execute(
            """
            ALTER TABLE runs
            ADD COLUMN reasoning_rounds_json TEXT NOT NULL DEFAULT '[]'
            """
        )
```

## 轮次数据结构

```json
{
  "round": 1,
  "title": "第 1 轮证据获取与推理",
  "reasoning": "当前里程计显示机器人没有实际移动，需要进一步检查控制指令。",
  "tool_calls": ["query_runtime_data", "query_message_mapping"],
  "evidence_ids": ["E-01", "E-02"],
  "evidence": []
}
```

最终结论轮：

```json
{
  "round": 3,
  "title": "最终结论",
  "reasoning": "【事实】...\n【推理】...\n【建议】...",
  "tool_calls": [],
  "evidence_ids": ["E-01", "E-02"],
  "evidence": []
}
```

## 保存函数

每轮工具调用全部执行完成后立即保存：

```python
def save_reasoning_rounds(run_id, rounds):
    connection = get_connection()
    try:
        connection.execute(
            """
            UPDATE runs
            SET reasoning_rounds_json = ?,
                progress = ?
            WHERE run_id = ?
            """,
            (
                json.dumps(rounds, ensure_ascii=False),
                f"已完成第 {len(rounds)} 轮 Agent 证据推理",
                run_id,
            ),
        )
        connection.commit()
    finally:
        connection.close()
```

不能只在 Agent loop 结束后保存，否则前端轮询看不到中间轮次。

## Agent loop 要求

后端 loop 应维护 `reasoning_rounds = []`。

每次 DeepSeek 返回工具调用后：

1. 保留完整的 assistant `tool_calls` 消息；
2. 执行本次响应中的全部工具调用；
3. 收集本轮新增 evidence；
4. 保存本轮的 `reasoning`、工具名和 evidence IDs；
5. 立即调用 `save_reasoning_rounds()`。

没有工具调用时：

1. 将响应内容作为最终输出；
2. 追加 `title = "最终结论"` 的轮次；
3. 保存后返回最终输出和轮次数组。

达到工具调用上限时，再请求一次不带工具的最终结论，并将其作为最终结论轮保存。

一次工具参数错误或工具返回错误可以记录在当前轮的工具结果中，但不能导致已保存的前序轮次丢失。

## 验证重试规则

`verify_output()` 失败后的格式重写属于最终结果校验，不是新的 Agent 证据轮次。因此验证重试不增加 `reasoning_rounds`。

如果需要审计，可以另外记录：

```json
{
  "verification_retry": true,
  "verification_errors": []
}
```

## API 返回

`GET /api/runs/{run_id}` 必须返回：

```json
{
  "run_id": "run-xxxx",
  "status": "reasoning",
  "progress": "已完成第 1 轮 Agent 证据推理",
  "reasoning_rounds": [
    {
      "round": 1,
      "title": "第 1 轮证据获取与推理",
      "reasoning": "...",
      "tool_calls": ["query_runtime_data"],
      "evidence_ids": ["E-01"],
      "evidence": []
    }
  ]
}
```

`row_to_run()` 中兼容旧记录：

```python
run["reasoning_rounds"] = json.loads(
    row["reasoning_rounds_json"] or "[]"
)
```

旧记录没有轮次时必须返回空数组，不能根据 `timeline` 补造轮次。

## 前端行为约束

前端只使用：

```ts
run.reasoning_rounds
```

没有轮次时显示“等待后端返回 Agent 推理轮次”，不显示固定的第一轮、第二轮或第三轮。

轮询效果：

```text
第一次轮询：reasoning_rounds = [第 1 轮]
第二次轮询：reasoning_rounds = [第 1 轮, 第 2 轮]
最终轮询：reasoning_rounds = [第 1 轮, 第 2 轮, 最终结论]
```

## 必须测试

使用 mock DeepSeek 响应模拟：

```text
第一次：tool_calls = query_runtime_data
第二次：tool_calls = query_message_mapping
第三次：无 tool_calls，返回最终结论
```

至少断言：

```python
assert len(rounds) == 3
assert rounds[0]["tool_calls"] == ["query_runtime_data"]
assert rounds[1]["tool_calls"] == ["query_message_mapping"]
assert rounds[2]["title"] == "最终结论"
```

还要覆盖：

- 首次响应直接返回最终结论；
- 一次响应包含多个工具调用；
- 工具参数错误；
- 工具无新 evidence；
- DeepSeek API 异常；
- 旧数据库缺少 `reasoning_rounds_json`；
- 验证重试不增加 Agent round。

## 部署检查

先确认文件编码为 UTF-8，并执行：

```bash
python3 -m py_compile backend/tracero_backend/app.py
```

然后重启：

```bash
sudo systemctl restart tracero-backend
```

发送一条新的机器人事件后检查：

```bash
curl -s http://127.0.0.1/api/runs/<run_id> | python3 -m json.tool
```

确认响应包含 `reasoning_rounds`，并且轮次数量会随着 Agent loop 增加。

只有当后端返回真实的 `reasoning_rounds` 后，前端进度条才会显示 DeepSeek Agent 的实际轮次。
