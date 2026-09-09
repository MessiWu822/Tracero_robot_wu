import type {
  RunDataProvenance,
  RunSectionSource,
  TraceroRun,
  UserRole,
} from './types'

const roleLabels: Record<UserRole, string> = {
  general: '通用',
  dev: '开发',
  test: '测试',
  ops: '运维',
}

const statusLabels: Record<TraceroRun['status'], string> = {
  reasoning: '推理中',
  done: '已完成',
  failed: '失败',
}

export type BugReportOptions = {
  generatedAt?: Date
  includeDemoAnalysis?: boolean
}

const sourceLabels: Record<RunSectionSource, string> = {
  backend: '后端真实数据',
  demo: '前端示例数据',
  legacy: '历史兼容数据',
  unavailable: '暂无数据',
}

function bullets(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function numbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n')
}

function provenanceFor(run: TraceroRun): RunDataProvenance {
  if (run.data_provenance) return run.data_provenance
  if (run.data_source === 'robot' || run.data_source === 'direct') {
    return {
      event: 'backend',
      conclusion: 'backend',
      evidence: run.evidence?.length ? 'backend' : 'unavailable',
      rich_analysis: 'unavailable',
    }
  }
  if (run.data_source === 'legacy') {
    return {
      event: 'legacy',
      conclusion: 'legacy',
      evidence: 'legacy',
      rich_analysis: 'legacy',
    }
  }
  return {
    event: 'demo',
    conclusion: 'demo',
    evidence: 'demo',
    rich_analysis: 'demo',
  }
}

export function hasDemoReportContent(run: TraceroRun, role: UserRole) {
  const provenance = provenanceFor(run)
  const hasDemoConclusion = provenance.conclusion === 'demo'
  const hasDemoEvidence =
    provenance.evidence === 'demo' && Boolean(run.evidence?.length)
  const hasDemoRoleAnalysis =
    provenance.rich_analysis === 'demo' &&
    ((role === 'dev' && Boolean(run.developerAnalysis)) ||
      (role === 'test' && Boolean(run.testAnalysis)) ||
      (role === 'ops' && Boolean(run.opsAnalysis)))

  return hasDemoConclusion || hasDemoEvidence || hasDemoRoleAnalysis
}

function baseSections(
  run: TraceroRun,
  role: UserRole,
  generatedAt: Date,
  includeDemoAnalysis: boolean
) {
  const provenance = provenanceFor(run)
  const includesDemoAnalysis =
    includeDemoAnalysis && hasDemoReportContent(run, role)
  const includesAnyDemo = provenance.event === 'demo' || includesDemoAnalysis

  return [
    '# Tracero Bug 报告',
    '',
    '## 基本信息',
    '',
    `- Run ID: ${run.run_id}`,
    `- 事件类型: ${run.event_type}`,
    `- 触发时间: ${run.trigger_time}`,
    `- 机器人: ${run.robot}`,
    `- 状态: ${statusLabels[run.status]}`,
    `- 当前视角: ${roleLabels[role]}`,
    `- 生成时间: ${generatedAt.toLocaleString('zh-CN', { hour12: false })}`,
    '',
    '## 数据来源',
    '',
    `- 事件信息: ${sourceLabels[provenance.event]}`,
    `- 分析结论: ${sourceLabels[provenance.conclusion]}`,
    `- 证据摘要: ${sourceLabels[provenance.evidence]}`,
    `- 富结构分析: ${sourceLabels[provenance.rich_analysis]}`,
    `- 示例内容导出: ${includesAnyDemo ? '是' : '否'}`,
    ...(includesAnyDemo
      ? [
          '',
          '> **注意：本报告包含前端示例数据，不应直接用于生产处置或缺陷归因。**',
        ]
      : []),
  ]
}

function generalSections(run: TraceroRun, includeDemoAnalysis: boolean) {
  const provenance = provenanceFor(run)
  const includeConclusion =
    provenance.conclusion !== 'demo' || includeDemoAnalysis
  const includeEvidence = provenance.evidence !== 'demo' || includeDemoAnalysis
  const evidence = includeEvidence ? run.evidence : undefined

  return [
    '',
    '## 分析结论',
    '',
    ...(includeConclusion
      ? [
          `### 事实\n\n${run.conclusion.fact}`,
          '',
          `### 推理\n\n${run.conclusion.reasoning}`,
          '',
          `### 建议\n\n${run.conclusion.suggestion}`,
        ]
      : ['示例分析结论已按默认设置排除。']),
    '',
    '## 证据摘要',
    '',
    ...(evidence?.length
      ? evidence.flatMap((item) => [
          `### ${item.evidence_id} ${item.title}`,
          '',
          `- 类型: ${item.type}`,
          `- 来源: ${item.source}`,
          ...(item.excerpt ? [`- 摘录: ${item.excerpt}`] : []),
          '',
          item.impact,
          '',
        ])
      : [
          provenance.evidence === 'demo' && !includeDemoAnalysis
            ? '示例证据已按默认设置排除。'
            : '暂无可导出的证据。',
          '',
        ]),
  ]
}

function developerSections(run: TraceroRun, includeDemoAnalysis: boolean) {
  const analysis = run.developerAnalysis
  const provenance = provenanceFor(run)
  if (
    !analysis ||
    (provenance.rich_analysis === 'demo' && !includeDemoAnalysis)
  ) {
    return [
      ...generalSections(run, includeDemoAnalysis),
      '## 开发定位',
      '',
      provenance.rich_analysis === 'demo'
        ? '示例开发分析已按默认设置排除。'
        : '暂无可导出的开发定位数据。',
    ]
  }

  return [
    ...generalSections(run, includeDemoAnalysis),
    '## 开发定位',
    '',
    analysis.technicalSummary,
    '',
    ...analysis.codeLocations.flatMap((location) => [
      `### ${location.evidence_id} ${location.module}`,
      '',
      `- 仓库: ${location.repository}`,
      `- 提交: ${location.commit}`,
      `- 文件: ${location.filePath}`,
      `- 行号: ${location.lineStart}-${location.lineEnd}`,
      ...(location.functionName ? [`- 函数: ${location.functionName}`] : []),
      '',
      location.explanation,
      '',
      '```' + location.language,
      location.content,
      '```',
      '',
    ]),
    '## 参数',
    '',
    ...analysis.parameters.map(
      (parameter) =>
        `- ${parameter.name}: ${parameter.value} -> ${parameter.recommendedValue} (${parameter.evidence_id}, ${parameter.filePath}:${parameter.line})`
    ),
  ]
}

function testSections(run: TraceroRun, includeDemoAnalysis: boolean) {
  const analysis = run.testAnalysis
  const provenance = provenanceFor(run)
  if (
    !analysis ||
    (provenance.rich_analysis === 'demo' && !includeDemoAnalysis)
  ) {
    return [
      '## 测试分析',
      '',
      provenance.rich_analysis === 'demo'
        ? '示例测试分析已按默认设置排除。'
        : '暂无可导出的测试分析数据。',
    ]
  }

  return [
    '',
    '## 测试结论',
    '',
    `### 模块归因\n\n${analysis.conclusion.attribution}`,
    '',
    `### 验证建议\n\n${analysis.conclusion.verification}`,
    '',
    `### 分配建议\n\n${analysis.conclusion.task}`,
    '',
    '## 受影响功能',
    '',
    bullets(analysis.affectedFeatures),
    '',
    '## 模块归因',
    '',
    ...analysis.modules.flatMap((module) => [
      `### ${module.module}`,
      '',
      `- 关系: ${module.relation === 'primary' ? '主归因' : '关联'}`,
      `- 置信度: ${module.confidence}%`,
      `- 证据: ${module.evidence_ids.join(', ')}`,
      '',
      module.responsibility,
      '',
    ]),
    '## 测试用例',
    '',
    ...analysis.testCases.flatMap((testCase) => [
      `### ${testCase.id} ${testCase.title}`,
      '',
      `- 优先级: ${testCase.priority}`,
      `- 状态: ${testCase.status}`,
      '',
      '**复现步骤**',
      '',
      numbered(testCase.steps),
      '',
      `**预期结果**\n\n${testCase.expected}`,
      '',
      `**实际结果**\n\n${testCase.actual}`,
      '',
    ]),
  ]
}

function opsSections(run: TraceroRun, includeDemoAnalysis: boolean) {
  const analysis = run.opsAnalysis
  const provenance = provenanceFor(run)
  if (
    !analysis ||
    (provenance.rich_analysis === 'demo' && !includeDemoAnalysis)
  ) {
    return [
      '## 运维分析',
      '',
      provenance.rich_analysis === 'demo'
        ? '示例运维分析已按默认设置排除。'
        : '暂无可导出的运维分析数据。',
    ]
  }

  return [
    '',
    '## 事件结论',
    '',
    `### 事件摘要\n\n${analysis.conclusion.summary}`,
    '',
    `### 业务影响\n\n${analysis.conclusion.impact}`,
    '',
    `### 处置建议\n\n${analysis.conclusion.response}`,
    '',
    '## 处置状态',
    '',
    `- 级别: ${analysis.severity}`,
    `- 状态: ${analysis.status}`,
    `- 负责人: ${analysis.owner}`,
    `- 开始时间: ${analysis.startedAt}`,
    `- 已持续: ${analysis.elapsed}`,
    '',
    '## 影响范围',
    '',
    ...analysis.impactAreas.map(
      (area) => `- ${area.label}: ${area.value} - ${area.detail}`
    ),
    '',
    '## 处置步骤',
    '',
    ...analysis.playbook.map(
      (step) =>
        `- ${step.id} ${step.title}: ${step.description}（负责人: ${step.owner}，预计: ${step.eta}）`
    ),
    '',
    '## 恢复准入条件',
    '',
    bullets(analysis.recoveryCriteria),
  ]
}

export function buildBugReport(
  run: TraceroRun,
  role: UserRole,
  options: BugReportOptions = {}
) {
  const generatedAt = options.generatedAt ?? new Date()
  const includeDemoAnalysis = options.includeDemoAnalysis ?? false
  const sections = baseSections(run, role, generatedAt, includeDemoAnalysis)

  if (role === 'dev')
    sections.push(...developerSections(run, includeDemoAnalysis))
  else if (role === 'test')
    sections.push(...testSections(run, includeDemoAnalysis))
  else if (role === 'ops')
    sections.push(...opsSections(run, includeDemoAnalysis))
  else sections.push(...generalSections(run, includeDemoAnalysis))

  return `${sections.join('\n').trim()}\n`
}

export function downloadBugReport(
  run: TraceroRun,
  role: UserRole,
  options: BugReportOptions = {}
) {
  const report = buildBugReport(run, role, options)
  const blob = new Blob(['\uFEFF', report], {
    type: 'text/markdown;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `tracero-bug-${run.run_id}-${role}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
