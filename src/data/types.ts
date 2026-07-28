/**
 * 课程数据模型定义
 * Course data model definitions
 */

export type Difficulty = '入门' | '进阶' | '高级' | '专家'

export type LessonType = '理论' | '实战' | '复盘'

export interface Lesson {
  /** 课程唯一编号，如 L01-01 */
  id: string
  /** 课程标题 */
  title: string
  /** 一句话简介 */
  summary: string
  /** 预计学习时长（分钟） */
  duration: number
  /** 课程类型 */
  type: LessonType
  /** 学习要点 */
  objectives: string[]
  /** 涉及的关键技术 / 工具 */
  tags: string[]
  /** 前置课程 ID 列表（可选） */
  prerequisites?: string[]
  /** 对应的架构师能力维度（可选） */
  competency?: string
}

export interface Project {
  id: string
  title: string
  summary: string
  /** 项目在课程中的位置（关联模块） */
  module: number
  /** 项目难度 */
  difficulty: Difficulty
  /** 项目预计实践时长（小时） */
  hours: number
  /** 交付物 */
  deliverables: string[]
  /** 用到的核心技术 */
  stack: string[]
}

export interface Module {
  /** 模块编号，从 1 开始 */
  id: number
  /** 模块标题 */
  title: string
  /** 模块副标题 / 主题 */
  subtitle: string
  /** 模块描述 */
  description: string
  /** 模块难度 */
  difficulty: Difficulty
  /**
   * 模块总时长（小时）= 精讲 + 实战。
   * 不变式：hours === Math.round(Σ lesson.duration / 60 + project.hours)
   * 由 scripts/check-curriculum.mjs 的 C1 检查项守护，勿手改单侧数值。
   */
  hours: number
  /** 模块图标（emoji 或符号） */
  icon: string
  /** 模块颜色主题，对应 tailwind 颜色键 */
  accent: string
  /** 该模块下的课程列表 */
  lessons: Lesson[]
  /** 该模块的实战项目 */
  project?: Project
}

export interface Curriculum {
  /** 课程总标题 */
  title: string
  tagline: string
  description: string
  modules: Module[]
}
