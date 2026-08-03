export const PUBLIC_DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD;

export const PUBLIC_DEMO_ACCOUNTS = [
  {
    label: "教师体验",
    email: "teacher@hotelsim.example",
    hint: "进入教师端，查看班级、回合与评分流程。",
  },
  {
    label: "评委体验",
    email: "judge@hotelsim.example",
    hint: "进入评委端，查看评分工作区与展示链路。",
  },
  {
    label: "学生体验",
    email: "student01@hotelsim.example",
    hint: "进入学生端，体验团队、决策与结果页面。",
  },
] as const;

// 管理员账号仍然保留，但不在公开登录提示中明文展示，避免演示环境把最高权限直接暴露出去。
export const HIDDEN_OPERATOR_ACCOUNT = {
  label: "平台管理员",
  email: "admin@hotelsim.example",
} as const;
