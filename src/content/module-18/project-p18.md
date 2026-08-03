
## P18：用 AI Coding 从零交付一个可上线的 Web 应用（全链路版）

### 目标
选一个你自己真正想用的小工具，用 OpenSpec + Superpowers + 社区 Skills + Harness 全链路工作流从规格写起，交付一个含前后端、有测试、有 CI/CD、能被陌生人打开使用的 Web 应用。

### 与 P17 的区别
P17 要求你掌握 AI Coding 的核心能力（上下文工程、规格驱动、UI 约束）。P18 在此基础上增加了**社区 Skills 的使用**——你不仅要知道怎么写 Skills，还要知道从哪里找现成的、怎么选、怎么组合、怎么把它们的产出串进工作流。P17 重在"自己能做"，P18 重在"借力社区做得更快更好"。

### 验收底线（必须全部完成）

1. **线上可访问的应用**（含域名或托管地址）
2. **OpenSpec 工作流产物**：proposal.md + specs/ + design.md + tasks.md + archive/
3. **Superpowers 流程产物**：brainstorming / plans / subagent 执行 / code-review 记录
4. **至少 3 个社区开源 Skills 的使用记录**，每个 Skill 需记录：
   - 选型理由（为什么选这个，备选方案是什么）
   - 安装方式和使用方法
   - 效果对比（用之前 vs 用之后的产出质量差异）
5. **至少 3 个自建 skills**（含 SKILL.md）
6. **测试套件与 CI/CD 流水线**
7. **AI 参与度与返工点记录**（含 OpenSpec / Superpowers / 社区 Skills 介入点分析）

### 推荐技术栈
- 前端：React 18 + TypeScript + Tailwind CSS
- 后端：Python 3.12 + FastAPI
- 工作流：OpenSpec + Superpowers
- Skills：至少 3 个社区 Skills（建议从 ui-ux-pro-max、grill-me、code-review-and-quality、vercel-deploy、claude-seo 中选择）
- CI/CD：GitHub Actions

### 社区 Skills 选型参考

下表列出 P18 项目中各阶段建议使用的社区 Skills，以及各自的替代方案：

| 阶段 | 首选 Skill | 备选 Skill | 什么时候用备选 |
|------|-----------|-----------|--------------|
| 方向校验 | grill-me (mattpocock) | 手动列问题清单 | grill-me 不可用或你已有成熟的评审流程 |
| UI 设计 | ui-ux-pro-max | 自建 design-tokens (L18-05) | 你已有成熟的设计系统 |
| UI 审计 | web-design-guidelines (Vercel) | 手动跑 Lighthouse | 你的技术栈不是 React/Next.js |
| 代码审查 | code-review-and-quality (addyosmani) | Superpowers code-review | 项目较小（< 5 个文件） |
| 安全审计 | trailofbits security-audit | GitHub CodeQL | 项目不涉及敏感数据 |
| 部署 | vercel-deploy | Cloudflare wrangler | 你需要边缘计算 / WebSocket |
| SEO | claude-seo | 手动 SEO 检查 | 产品不面向公开互联网 |
| 质量诊断 | web-quality-skills (addyosmani) | 手动 Lighthouse | - |

### 交付物清单
- [ ] 线上可访问的应用（含域名或托管地址）
- [ ] OpenSpec 工作流产物（proposal.md + specs/ + design.md + tasks.md + archive/）
- [ ] Superpowers 流程产物（brainstorming / plans / subagent 执行 / code-review 记录）
- [ ] 至少 3 个社区 Skills 使用记录（每个含选型理由 + 使用方法 + 效果对比）
- [ ] 至少 3 个自建 skills（含 SKILL.md）
- [ ] 测试套件（单元测试 + 集成测试）
- [ ] CI/CD 流水线（GitHub Actions 配置）
- [ ] UI 设计 token 定义文件与质量检查报告
- [ ] AI 参与度与返工点记录（含全链路介入点分析）

### 评分维度
- 功能完成度（20%）
- 代码质量（20%）
- OpenSpec + Superpowers 工作流完成度（15%）
- 社区 Skills 使用质量（选型合理性 + 效果对比）（15%）
- 自建 Skills 质量（可复用性）（10%）
- 测试覆盖与 CI/CD 配置（10%）
- AI 参与度记录的诚实度与洞察深度（10%）
