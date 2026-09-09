# Tracero 方案二：统一基础分析，前端按视角筛选

## 目的

后端只生成并保存一份完整 Run 分析；前端根据 `general`、`dev`、`test`、`ops` 筛选证据并组织展示。这样可以避免同一事件因为切换视角产生多个 Run，也避免不同视角返回结构不一致导致日志和证据丢失。

后端负责真实事实、证据、推理和关联关系；前端只负责筛选、排序、分组和展示，不自行生成根因结论。

## 必须保持的 Run 规则

```text
相同 event_id -> 复用相同 run_id
```

以下请求必须返回相同的 `run_id`、`event_id` 和同一组 `reasoning_rounds`：

```http
GET /api/runs/{run_id}?perspective=general
GET /api/runs/{run_id}?perspective=dev
GET /api/runs/{run_id}?perspective=test
GET /api/runs/{run_id}?perspective=ops
```

视角参数不能创建新的 Run，也不能重新创建独立推理轮次。

## 统一接口返回结构

```json
{
  "run_id": "run-xxx",
  "event_id": "event-xxx",
  "perspective": "dev",
  "available_perspectives": ["general", "dev", "test", "ops"],
  "conclusion": {
    "fact": "机器人前方障碍物距离持续下降",
    "reasoning": "障碍物距离触发局部规划器减速",
    "suggestion": "检查局部代价地图和避障参数"
  },
  "evidence": [],
  "evidence_ids": [],
  "reasoning_rounds": [],
  "evidence_by_perspective": {
    "general": [],
    "dev": [],
    "test": [],
    "ops": []
  }
}
```

如果保留 `perspective_view`，它可以作为兼容字段，但顶层基础数据也必须完整。不能只返回证据数量、摘要或模型文本中的证据 ID。

## 证据字段要求

每条证据至少需要：

```text
evidence_id
type
title
source
excerpt 或 content
impact
perspectives
```

其中 `impact` 必须说明该证据对本次异常的具体影响，不能统一为空或返回“后端未提供该证据的影响说明”。

统一使用以下证据类型：

```text
source_code
message_mapping
parameter
runtime
log
metric
config
```

开发视角所需字段：

- `source_code`：文件路径、起止行号、函数、模块、仓库、提交、代码片段、影响说明
- `parameter`：参数名、当前值、建议值、单位、来源、影响说明
- `runtime`：节点、话题、时间戳、运行时值、影响说明
- `message_mapping`：上下游话题、上下游节点、相关模块、影响说明

## reasoning rounds 关联

`reasoning_rounds` 只保存一份，属于同一个 Run。每个 `evidence_ids` 必须能在顶层 `evidence` 中找到完整证据对象：

```json
{
  "round": 1,
  "title": "确认运行时异常",
  "reasoning": "根据 /scan 和 /odom 判断机器人正在接近障碍物",
  "tool_calls": [],
  "evidence_ids": ["E-01", "E-02", "E-03"]
}
```

可以额外在 round 中返回完整 `evidence`，但不能只返回无法解析的 ID，也不能出现 ID 与实体不一致。

## 统一结论

方案二暂时只需要一套统一结论：

```json
{
  "conclusion": {
    "fact": "...",
    "reasoning": "...",
    "suggestion": "..."
  }
}
```

结论必须基于真实证据，并说明异常事实、证据支持、受影响模块或链路以及建议动作。后续如需专业化结论，再增加 `perspective_conclusions`，不是当前必需项。

## 建议增加视角索引

```json
{
  "evidence_by_perspective": {
    "general": ["E-01", "E-02", "E-03"],
    "dev": ["E-01", "E-02", "E-201", "E-202"],
    "test": ["E-01", "E-02", "E-202"],
    "ops": ["E-01", "E-03", "E-203"]
  }
}
```

这些 ID 必须都能在 `evidence` 中解析到完整证据对象。

## Chat 追问

当前 Run 的追问必须使用：

```http
POST /api/runs/{run_id}/chat
```

```json
{
  "message": "这个异常对应哪个模块？",
  "context": {"perspective": "dev"}
}
```

不要发送到 `/api/debug/reason`，否则会创建新的独立推理记录。

## 验收标准

使用同一个 Run 请求四个视角，确认：

- `run_id`、`event_id` 相同；
- `reasoning_rounds` 属于同一个 Run；
- 每个证据 ID 都能解析到完整证据；
- 每条证据有 `type`、`source`、`excerpt/content` 和 `impact`；
- 开发证据包含代码位置、参数、运行时和消息链路字段；
- 视角切换只改变筛选范围，不创建新的 Run；
- 同一个 `event_id` 重复上报不会产生新的历史记录；
- `/chat` 追问不会创建新的独立调试推理。

## 核心结论

后端需要保证一份完整、稳定、可关联的基础分析数据；前端负责视角筛选和展示。当前最重要的不是生成四套重复结论，而是补齐证据实体、证据 ID 关联、影响说明以及开发定位字段。
