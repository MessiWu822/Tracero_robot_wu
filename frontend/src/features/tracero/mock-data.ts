export type RunStatus = 'reasoning' | 'done' | 'failed'
export type UserRole = 'general' | 'dev' | 'test' | 'ops'
export type TimelineLevel = 'info' | 'warning' | 'critical' | 'success'
export type EvidenceType = 'log' | 'code' | 'metric' | 'config'
export type CodeLanguage = 'cpp' | 'yaml' | 'log'

export type CodeLocation = {
  id: string
  evidence_id: string
  repository: string
  commit: string
  module: string
  filePath: string
  functionName?: string
  lineStart: number
  lineEnd: number
  highlightLines: number[]
  language: CodeLanguage
  content: string
  explanation: string
}

export type CallChainNode = {
  id: string
  label: string
  detail: string
  type: 'topic' | 'module' | 'function' | 'decision'
  status: 'normal' | 'warning' | 'error'
  depth: number
  evidence_ids: string[]
  codeLocationId?: string
  elapsedMs?: number
}

export type ParameterEvidence = {
  name: string
  value: string
  recommendedValue: string
  filePath: string
  line: number
  evidence_id: string
  codeLocationId: string
}

export type LogEvidence = {
  time: string
  level: 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
  evidence_id: string
  codeLocationId?: string
}

export type TestModuleAttribution = {
  module: string
  responsibility: string
  confidence: number
  relation: 'primary' | 'related'
  evidence_ids: string[]
}

export type TestCase = {
  id: string
  title: string
  type: 'reproduction' | 'regression' | 'boundary'
  priority: 'P0' | 'P1' | 'P2'
  preconditions: string[]
  testData: string[]
  steps: string[]
  expected: string
  actual: string
  status: 'failed' | 'pending' | 'passed'
}

export type TestTask = {
  id: string
  title: string
  owner: string
  priority: 'P0' | 'P1' | 'P2'
  dueDate: string
  status: '待创建' | '待处理' | '进行中' | '已完成'
}

export const mockStats = {
  reasoning: 1,
  completed: 5,
  failed: 0,
}

export const mockRuns = [
  {
    run_id: 'run_20260527_143207',
    event_type: '导航失败',
    trigger_time: '14:32:07',
    status: 'reasoning' as RunStatus,
    summary: 'costmap 更新延迟导致导航失败',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260527_131544',
    event_type: '急停触发',
    trigger_time: '13:15:44',
    status: 'done' as RunStatus,
    summary: '速度异常导致急停',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260527_110821',
    event_type: '路径重规划',
    trigger_time: '11:08:21',
    status: 'done' as RunStatus,
    summary: '目标点不可达，重新规划路径',
    robot: 'robot_002',
  },
  {
    run_id: 'run_20260526_094412',
    event_type: '导航失败',
    trigger_time: '昨天 09:44',
    status: 'done' as RunStatus,
    summary: '传感器丢帧导致定位偏差',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260526_083001',
    event_type: '参数异常',
    trigger_time: '昨天 08:30',
    status: 'done' as RunStatus,
    summary: 'inflation_radius 设置过小，路径规划失败',
    robot: 'robot_002',
  },
  {
    run_id: 'run_20260525_213000',
    event_type: '地图加载',
    trigger_time: '5月25日 21:30',
    status: 'failed' as RunStatus,
    summary: '地图文件缺失，推理任务未启动',
    robot: 'robot_003',
  },
]

export const mockCurrentRun = {
  run_id: 'run_20260527_143207',
  event_type: '导航失败',
  trigger_time: '14:32:07',
  status: 'reasoning' as RunStatus,
  robot: 'robot_001',
  conclusion: {
    fact: 'costmap 更新延迟 340ms，障碍物出现时局部代价地图未能及时更新 [E-03]',
    reasoning:
      'controller_server.cpp 第 387 行 [E-02] 在生成速度指令时读取的是 340ms 前的旧地图，障碍物信息未传达至规划模块，导致未能刹车',
    suggestion:
      '建议将 update_frequency 从 5.0 Hz 调高到 10.0 Hz，或排查 LiDAR 数据传输延迟原因',
  },
  timeline: [
    {
      time: '14:32:07.120',
      title: '导航任务启动',
      description: 'robot_001 接收到目标点，planner_server 生成初始路径。',
      level: 'info' as TimelineLevel,
    },
    {
      time: '14:32:08.430',
      title: 'LiDAR 捕获障碍物',
      description: '前方 1.8m 出现动态障碍物，传感器数据进入 costmap 管线。',
      level: 'warning' as TimelineLevel,
    },
    {
      time: '14:32:08.770',
      title: '局部代价地图延迟',
      description: 'costmap 更新时间差达到 340ms，障碍物未进入速度控制计算。',
      level: 'critical' as TimelineLevel,
    },
    {
      time: '14:32:08.930',
      title: '速度指令未降速',
      description:
        'controller_server 仍基于旧地图输出 cmd_vel，机器人继续前进。',
      level: 'critical' as TimelineLevel,
    },
    {
      time: '14:32:09.020',
      title: '触发导航失败',
      description: '安全监测模块中止当前导航任务，生成推理工单。',
      level: 'success' as TimelineLevel,
    },
  ],
  evidence: [
    {
      evidence_id: 'E-01',
      type: 'metric' as EvidenceType,
      title: 'costmap 更新时间差',
      source: 'telemetry/costmap_latency',
      excerpt: 'avg=212ms, p95=340ms, threshold=200ms',
      impact: '关键指标超过阈值，证明局部代价地图存在明显更新延迟。',
    },
    {
      evidence_id: 'E-02',
      type: 'code' as EvidenceType,
      title: '速度控制读取旧地图',
      source: 'controller_server.cpp:387',
      excerpt: 'computeVelocityCommands(costmap_ros_->getCostmap())',
      impact: '速度指令生成依赖 costmap 快照，延迟会直接影响刹停决策。',
    },
    {
      evidence_id: 'E-03',
      type: 'log' as EvidenceType,
      title: '障碍物进入管线但未及时生效',
      source: 'nav2_controller.log',
      excerpt:
        '[14:32:08.770] obstacle observation buffered, map update pending',
      impact: '日志与遥测时间线吻合，支持“数据已到达但地图未刷新”的判断。',
    },
    {
      evidence_id: 'E-04',
      type: 'config' as EvidenceType,
      title: '更新频率偏低',
      source: 'nav2_params.yaml:23',
      excerpt: 'update_frequency: 5.0',
      impact: '5Hz 配置意味着 200ms 更新周期，高动态场景下缺少余量。',
    },
  ],
  developerAnalysis: {
    technicalSummary:
      '局部代价地图更新链路出现 340ms 延迟，ControllerServer 在控制周期内读取了过期 Costmap 快照，导致速度指令没有及时响应动态障碍物。',
    defaultCodeLocationId: 'LOC-E02',
    callChain: [
      {
        id: 'CHAIN-01',
        label: '/scan',
        detail: 'LiDAR 障碍物观测进入导航栈',
        type: 'topic' as const,
        status: 'normal' as const,
        depth: 0,
        evidence_ids: ['E-03'],
        elapsedMs: 0,
      },
      {
        id: 'CHAIN-02',
        label: 'ObstacleLayer::bufferCloud()',
        detail: '观测数据已进入 costmap 缓冲区',
        type: 'function' as const,
        status: 'normal' as const,
        depth: 1,
        evidence_ids: ['E-03'],
        elapsedMs: 18,
      },
      {
        id: 'CHAIN-03',
        label: 'Costmap2DROS::updateMap()',
        detail: '更新周期受 5Hz 配置限制，地图刷新滞后',
        type: 'function' as const,
        status: 'warning' as const,
        depth: 2,
        evidence_ids: ['E-01', 'E-04'],
        codeLocationId: 'LOC-E04',
        elapsedMs: 340,
      },
      {
        id: 'CHAIN-04',
        label: 'ControllerServer::computeControl()',
        detail: '控制循环读取尚未包含新障碍物的 Costmap',
        type: 'function' as const,
        status: 'error' as const,
        depth: 3,
        evidence_ids: ['E-02', 'E-03'],
        codeLocationId: 'LOC-E02',
        elapsedMs: 356,
      },
      {
        id: 'CHAIN-05',
        label: 'computeVelocityCommands()',
        detail: '基于旧地图继续输出前进速度',
        type: 'decision' as const,
        status: 'error' as const,
        depth: 4,
        evidence_ids: ['E-02'],
        codeLocationId: 'LOC-E02',
        elapsedMs: 372,
      },
    ] satisfies CallChainNode[],
    codeLocations: [
      {
        id: 'LOC-E02',
        evidence_id: 'E-02',
        repository: 'navigation2',
        commit: '9d6f7ab',
        module: 'nav2_controller',
        filePath: 'nav2_controller/src/controller_server.cpp',
        functionName: 'ControllerServer::computeControl()',
        lineStart: 376,
        lineEnd: 399,
        highlightLines: [387, 388, 389, 390],
        language: 'cpp' as const,
        explanation:
          '控制循环直接从 costmap_ros_ 获取当前快照。此处没有验证地图时间戳是否超过安全阈值，因此延迟地图仍会进入速度规划。',
        content: `void ControllerServer::computeControl()
{
  geometry_msgs::msg::PoseStamped pose;
  nav_2d_msgs::msg::Twist2D velocity;

  if (!getRobotPose(pose)) {
    throw nav2_core::ControllerException("Failed to obtain robot pose");
  }

  getThresholdedTwist(odom_sub_->getTwist(), velocity);

  const auto costmap = costmap_ros_->getCostmap();
  const auto command = controller_->computeVelocityCommands(
    pose,
    velocity,
    goal_checker_.get()
  );

  publishVelocity(command.velocity);
  action_server_->publish_feedback(command);

  if (isGoalReached()) {
    action_server_->succeeded_current();
  }
}`,
      },
      {
        id: 'LOC-E04',
        evidence_id: 'E-04',
        repository: 'tracero_robot_config',
        commit: '4bc813e',
        module: 'nav2_bringup',
        filePath: 'config/nav2_params.yaml',
        functionName: 'local_costmap.local_costmap.ros__parameters',
        lineStart: 17,
        lineEnd: 35,
        highlightLines: [23],
        language: 'yaml' as const,
        explanation:
          'update_frequency 当前为 5Hz，理论更新周期是 200ms。在传感器和计算链路存在额外开销时，无法为动态障碍物场景留出足够余量。',
        content: `local_costmap:
  local_costmap:
    ros__parameters:
      global_frame: odom
      robot_base_frame: base_link
      update_frequency: 5.0
      publish_frequency: 2.0
      rolling_window: true
      width: 3
      height: 3
      resolution: 0.05
      robot_radius: 0.22
      plugins:
        - voxel_layer
        - inflation_layer
      inflation_layer:
        inflation_radius: 0.55`,
      },
      {
        id: 'LOC-E03',
        evidence_id: 'E-03',
        repository: 'robot_001_runtime',
        commit: 'run_20260527_143207',
        module: 'nav2_controller',
        filePath: 'logs/nav2_controller.log',
        lineStart: 141,
        lineEnd: 149,
        highlightLines: [145, 146],
        language: 'log' as const,
        explanation:
          '日志证明障碍物观测已经进入缓冲区，但地图更新仍在等待下一周期，与遥测中的 340ms 延迟一致。',
        content: `[14:32:08.430] [INFO] [obstacle_layer] observation received frame=laser
[14:32:08.448] [INFO] [tf_buffer] transform laser -> odom resolved
[14:32:08.611] [WARN] [local_costmap] update cycle missed target duration
[14:32:08.770] [WARN] [local_costmap] obstacle observation buffered
[14:32:08.770] [WARN] [local_costmap] map update pending age_ms=340
[14:32:08.812] [INFO] [controller_server] computing velocity command
[14:32:08.930] [ERROR] [safety_monitor] stale costmap used for cmd_vel
[14:32:09.020] [ERROR] [bt_navigator] navigation task aborted`,
      },
    ] satisfies CodeLocation[],
    parameters: [
      {
        name: 'update_frequency',
        value: '5.0 Hz',
        recommendedValue: '10.0 Hz',
        filePath: 'config/nav2_params.yaml',
        line: 23,
        evidence_id: 'E-04',
        codeLocationId: 'LOC-E04',
      },
      {
        name: 'controller_frequency',
        value: '20.0 Hz',
        recommendedValue: '20.0 Hz（保持）',
        filePath: 'config/nav2_params.yaml',
        line: 61,
        evidence_id: 'E-02',
        codeLocationId: 'LOC-E02',
      },
    ] satisfies ParameterEvidence[],
    logs: [
      {
        time: '14:32:08.770',
        level: 'WARN' as const,
        source: 'local_costmap',
        message: 'map update pending age_ms=340',
        evidence_id: 'E-03',
        codeLocationId: 'LOC-E03',
      },
      {
        time: '14:32:08.930',
        level: 'ERROR' as const,
        source: 'safety_monitor',
        message: 'stale costmap used for cmd_vel',
        evidence_id: 'E-02',
        codeLocationId: 'LOC-E02',
      },
    ] satisfies LogEvidence[],
    runtimeMetrics: [
      { label: 'Costmap P95 延迟', value: '340ms', status: 'critical' },
      { label: '目标更新周期', value: '200ms', status: 'warning' },
      { label: '控制频率', value: '20Hz', status: 'normal' },
      { label: '受影响控制周期', value: '7 次', status: 'critical' },
    ],
  },
  testAnalysis: {
    conclusion: {
      attribution:
        '主归因模块为 nav2_controller（92%），关联模块为 local_costmap（86%）与 obstacle_layer（74%）。',
      verification:
        '在动态障碍物场景下复现 5Hz Costmap 更新，验证地图延迟超过 200ms 时控制器是否仍输出前进速度。',
      task:
        '建议由导航测试组负责人林晓执行 P0 验证，今天 18:00 前完成复现并回归紧急制动链路。',
    },
    affectedFeatures: [
      '动态障碍物避让',
      '局部路径跟踪',
      '紧急制动',
      '速度指令发布',
    ],
    modules: [
      {
        module: 'nav2_controller',
        responsibility: '读取 Costmap 快照并生成速度指令，是异常行为的直接发生模块。',
        confidence: 92,
        relation: 'primary' as const,
        evidence_ids: ['E-02', 'E-03'],
      },
      {
        module: 'local_costmap',
        responsibility: '地图更新周期超过安全阈值，向控制器提供了过期快照。',
        confidence: 86,
        relation: 'related' as const,
        evidence_ids: ['E-01', 'E-04'],
      },
      {
        module: 'obstacle_layer',
        responsibility: '障碍物观测已进入缓冲区，需要验证数据写入和地图刷新之间的时序。',
        confidence: 74,
        relation: 'related' as const,
        evidence_ids: ['E-03'],
      },
    ] satisfies TestModuleAttribution[],
    testCases: [
      {
        id: 'TC-NAV-042',
        title: '5Hz Costmap 下动态障碍物制动验证',
        type: 'reproduction' as const,
        priority: 'P0' as const,
        preconditions: [
          'robot_001 使用 navigation2 提交 9d6f7ab',
          'local_costmap.update_frequency 设置为 5.0Hz',
          '控制频率保持 20Hz，测试场地无其他移动物体',
        ],
        testData: [
          '初始速度 0.6m/s',
          '障碍物距离 1.8m',
          '障碍物横向速度 0.4m/s',
          'Costmap 延迟注入 340ms',
        ],
        steps: [
          '启动导航并让机器人沿直线路径稳定运行。',
          '在机器人前方 1.8m 处横向移入动态障碍物。',
          '记录 /scan、local_costmap、cmd_vel 与 safety_monitor 时间戳。',
          '重复执行 10 次，统计制动距离和过期地图使用次数。',
        ],
        expected:
          '障碍物进入安全距离后，下一控制周期内 cmd_vel.linear.x 降为 0，且不得使用超过 200ms 的 Costmap。',
        actual:
          'Costmap age 达到 340ms 时，控制器仍输出前进速度，随后由 safety_monitor 中止导航。',
        status: 'failed' as const,
      },
      {
        id: 'TC-NAV-043',
        title: '10Hz Costmap 参数调整回归',
        type: 'regression' as const,
        priority: 'P1' as const,
        preconditions: [
          'update_frequency 调整为 10.0Hz',
          '其余导航参数与故障场景保持一致',
        ],
        testData: ['同 TC-NAV-042 动态障碍物轨迹', '连续执行 30 次'],
        steps: [
          '应用 10Hz 参数并重启导航栈。',
          '重复动态障碍物横穿场景。',
          '检查 Costmap P95 延迟、制动距离和 CPU 占用。',
        ],
        expected:
          'Costmap P95 延迟低于 150ms，30 次测试均在安全距离内停止，CPU 峰值不超过 80%。',
        actual: '待执行。',
        status: 'pending' as const,
      },
      {
        id: 'TC-NAV-044',
        title: 'Costmap 延迟阈值边界测试',
        type: 'boundary' as const,
        priority: 'P1' as const,
        preconditions: ['支持注入可控 Costmap 延迟'],
        testData: ['延迟档位：150ms、200ms、250ms、340ms'],
        steps: [
          '依次注入四档延迟。',
          '每档执行 10 次速度规划。',
          '验证超过阈值后的降速、停止和错误日志。',
        ],
        expected:
          '延迟超过 200ms 时禁止继续发布前进速度，并输出可定位的 stale costmap 日志。',
        actual: '待执行。',
        status: 'pending' as const,
      },
    ] satisfies TestCase[],
    regressionScope: [
      'Controller Server 速度规划',
      'Local Costmap 更新与发布',
      'Obstacle Layer 观测缓冲',
      'Safety Monitor 紧急停止',
      '导航失败恢复流程',
    ],
    tasks: [
      {
        id: 'TEST-219',
        title: '复现 Costmap 过期导致的未制动问题',
        owner: '林晓',
        priority: 'P0' as const,
        dueDate: '今天 18:00',
        status: '待创建' as const,
      },
      {
        id: 'TEST-220',
        title: '执行 10Hz 参数调整后的导航回归',
        owner: '周晨',
        priority: 'P1' as const,
        dueDate: '明天 12:00',
        status: '待处理' as const,
      },
    ] satisfies TestTask[],
  },
  opsAnalysis: {
    conclusion: {
      summary:
        'robot_001 在执行导航任务时因局部地图更新延迟，未能及时识别动态障碍物，安全模块已自动中止任务。',
      impact:
        '当前影响 robot_001 的导航与配送任务，同型号机器人存在相同配置风险；尚未发现人员或设备损伤。',
      response:
        '立即暂停 robot_001 自动导航，将同批机器人切换为限速模式，核查 Costmap 延迟后再逐台恢复。',
    },
    severity: 'P1 高优先级',
    status: '处置中',
    startedAt: '14:32:09',
    elapsed: '18 分钟',
    owner: '现场运维组 / 王宁',
    impactAreas: [
      {
        label: '受影响机器人',
        value: '1 / 12',
        detail: 'robot_001 已停止自动导航',
        status: 'critical' as const,
      },
      {
        label: '受影响任务',
        value: '3',
        detail: '1 个中止，2 个等待重新调度',
        status: 'warning' as const,
      },
      {
        label: '业务区域',
        value: 'A3 仓区',
        detail: '主通道暂时采用人工接管',
        status: 'warning' as const,
      },
      {
        label: '安全事件',
        value: '0',
        detail: '安全模块在碰撞前中止任务',
        status: 'normal' as const,
      },
    ],
    liveMetrics: [
      {
        label: 'Costmap P95 延迟',
        value: '340ms',
        threshold: '阈值 200ms',
        status: 'critical' as const,
      },
      {
        label: '机器人连接',
        value: '在线',
        threshold: '心跳正常',
        status: 'normal' as const,
      },
      {
        label: '控制器状态',
        value: '已停止',
        threshold: '等待人工确认',
        status: 'warning' as const,
      },
      {
        label: '待执行任务',
        value: '2',
        threshold: '已暂停分配',
        status: 'warning' as const,
      },
    ],
    playbook: [
      {
        id: 'OPS-01',
        title: '隔离故障机器人',
        description: '暂停 robot_001 自动导航，保留遥控和急停能力。',
        owner: '王宁',
        eta: '立即',
        command: '暂停自动导航',
      },
      {
        id: 'OPS-02',
        title: '启用同批机器人限速策略',
        description: '将 A3 仓区同型号机器人最高速度临时限制为 0.3m/s。',
        owner: '陈浩',
        eta: '5 分钟',
        command: '启用限速模式',
      },
      {
        id: 'OPS-03',
        title: '调整地图更新参数',
        description: '将 update_frequency 从 5Hz 调整为 10Hz，并观察 CPU 与延迟。',
        owner: '导航值班',
        eta: '15 分钟',
        command: '应用临时参数',
      },
      {
        id: 'OPS-04',
        title: '执行恢复前验证',
        description: '完成动态障碍物制动测试后，仅恢复 robot_001 的空载任务。',
        owner: '测试值班',
        eta: '30 分钟',
        command: '开始恢复验证',
      },
    ],
    communications: [
      {
        time: '14:34',
        audience: '仓区现场',
        message: 'A3 主通道机器人导航暂停，请暂时使用备用通道。',
        status: '已通知',
      },
      {
        time: '14:38',
        audience: '调度中心',
        message: '3 个配送任务受到影响，正在重新分配至 robot_004。',
        status: '已通知',
      },
      {
        time: '待发送',
        audience: '值班负责人',
        message: '等待参数调整和恢复验证结果后发送事件进展。',
        status: '待通知',
      },
    ],
    recoveryCriteria: [
      'Costmap P95 延迟连续 10 分钟低于 150ms',
      '动态障碍物制动测试连续 10 次通过',
      'robot_001 空载导航运行 15 分钟无异常',
      '现场负责人确认 A3 主通道可以恢复',
    ],
  },
  chatHistory: [
    {
      role: 'user' as const,
      content: 'inflation_radius 在哪定义的？',
    },
    {
      role: 'ai' as const,
      content:
        'inflation_radius 定义在 nav2_params.yaml 第 45 行，当前值为 0.55。这个参数控制障碍物膨胀半径，影响路径规划时对障碍物的避让距离。',
    },
    {
      role: 'user' as const,
      content: 'update_frequency 现在是多少？',
    },
    {
      role: 'ai' as const,
      content:
        'update_frequency 当前值为 5.0 Hz，定义在 nav2_params.yaml 第 23 行。这意味着局部代价地图每 200ms 更新一次，在高速场景下可能出现更新延迟。',
    },
  ],
}

export const roleLabels: Record<UserRole, string> = {
  general: '通用',
  dev: '开发',
  test: '测试',
  ops: '运维',
}

export const statusLabels: Record<RunStatus, string> = {
  reasoning: '推理中',
  done: '已完成',
  failed: '失败',
}
