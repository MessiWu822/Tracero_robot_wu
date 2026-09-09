import { describe, expect, it } from 'vitest'
import { buildBugReport } from './bug-report'
import { mockCurrentRun } from './mock-data'

const generatedAt = new Date('2026-08-21T10:00:00+08:00')

describe('buildBugReport', () => {
  it('includes source locations in the developer report', () => {
    const report = buildBugReport(mockCurrentRun, 'dev', {
      generatedAt,
      includeDemoAnalysis: true,
    })

    expect(report).toContain(mockCurrentRun.run_id)
    expect(report).toContain('nav2_controller/src/controller_server.cpp')
    expect(report).toContain('computeVelocityCommands')
    expect(report).toContain('当前视角: 开发')
  })

  it.each(['test', 'ops'] as const)(
    'does not leak source details in the %s report',
    (role) => {
      const report = buildBugReport(mockCurrentRun, role, {
        generatedAt,
        includeDemoAnalysis: true,
      })

      expect(report).not.toContain('nav2_controller/src/controller_server.cpp')
      expect(report).not.toContain('controller_server.cpp:387')
      expect(report).not.toContain('computeVelocityCommands(costmap_ros_')
    }
  )

  it('exports role-specific test and operations content', () => {
    const testReport = buildBugReport(mockCurrentRun, 'test', {
      generatedAt,
      includeDemoAnalysis: true,
    })
    const opsReport = buildBugReport(mockCurrentRun, 'ops', {
      generatedAt,
      includeDemoAnalysis: true,
    })

    expect(testReport).toContain(
      mockCurrentRun.testAnalysis.conclusion.attribution
    )
    expect(testReport).toContain(mockCurrentRun.testAnalysis.testCases[0].id)
    expect(opsReport).toContain(mockCurrentRun.opsAnalysis.conclusion.summary)
    expect(opsReport).toContain(mockCurrentRun.opsAnalysis.recoveryCriteria[0])
  })

  it('excludes demo evidence and rich analysis by default', () => {
    const report = buildBugReport(mockCurrentRun, 'dev', { generatedAt })

    expect(report).toContain('示例内容导出: 是')
    expect(report).toContain('示例分析结论已按默认设置排除')
    expect(report).toContain('示例证据已按默认设置排除')
    expect(report).toContain('示例开发分析已按默认设置排除')
    expect(report).not.toContain('controller_server.cpp')
  })

  it('labels included demo content with a production-use warning', () => {
    const report = buildBugReport(mockCurrentRun, 'general', {
      generatedAt,
      includeDemoAnalysis: true,
    })

    expect(report).toContain('证据摘要: 前端示例数据')
    expect(report).toContain('示例内容导出: 是')
    expect(report).toContain('不应直接用于生产处置或缺陷归因')
  })
})
