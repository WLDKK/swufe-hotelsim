from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


TODAY = date.today().isoformat()
DEFAULT_OUTPUT = (
    Path.home() / "Desktop" / f"SWUFE_HotelSim_C方案_正式上线版交付清单_{TODAY}.docx"
)
BLUE_PRIMARY = RGBColor(31, 78, 121)


def configure_document(doc: Document) -> None:
    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

    normal = doc.styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)

    for style_name, size, bold in [
        ("Title", 20, True),
        ("Heading 1", 15, True),
        ("Heading 2", 12.5, True),
        ("Heading 3", 11.5, True),
    ]:
        style = doc.styles[style_name]
        style.font.name = "Microsoft YaHei"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
        style.font.size = Pt(size)
        style.font.bold = bold


def add_title_block(doc: Document) -> None:
    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run("SWUFE HotelSim 项目交付准备清单")
    title_run.font.color.rgb = BLUE_PRIMARY

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.add_run("方案 C：正式上线版 / 完整移交版").bold = True

    summary = doc.add_paragraph()
    summary.alignment = WD_ALIGN_PARAGRAPH.CENTER
    summary.add_run(
        "适用场景：项目需部署到接收方名下环境，后续由接收方独立持有并持续运营。"
    )

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run(f"生成日期：{TODAY}")

    doc.add_paragraph("")


def add_section(doc: Document, title: str, paragraphs: list[str]) -> None:
    doc.add_paragraph(title, style="Heading 1")
    for text in paragraphs:
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(4)
        paragraph.add_run(text)


def add_bullets(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.space_after = Pt(2)
        paragraph.add_run(item)


def add_numbered(doc: Document, items: list[str]) -> None:
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.paragraph_format.space_after = Pt(2)
        paragraph.add_run(item)


def add_table(
    doc: Document,
    title: str,
    headers: list[str],
    rows: list[list[str]],
) -> None:
    doc.add_paragraph(title, style="Heading 2")
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.autofit = True

    for index, header in enumerate(headers):
        paragraph = table.rows[0].cells[index].paragraphs[0]
        run = paragraph.add_run(header)
        run.bold = True

    for row in rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = value

    doc.add_paragraph("")


def add_reply_template(doc: Document) -> None:
    doc.add_paragraph("建议接收方回复模板", style="Heading 1")
    doc.add_paragraph(
        "为便于快速推进，可请接收方直接按以下格式回复。若暂时没有某项资源，也可以写“暂无，接受临时过渡方案”。"
    )
    template_items = [
        "本次交付目标：正式上线版 / 先验收后上线 / 其他",
        "是否已有 Supabase 项目：有 / 无",
        "是否已有 Vercel 账号：有 / 无",
        "是否已有正式域名：有 / 无",
        "是否接受先使用临时访问地址：接受 / 不接受",
        "是否允许开发方先代为注册并在验收后移交：允许 / 不允许",
        "是否需要公开注册：需要 / 暂不需要",
        "是否需要邮箱验证：需要 / 暂不需要",
        "是否需要密码找回：需要 / 暂不需要",
        "是否需要外部告警：需要 / 暂不需要",
        "是否已有老师最终公式：有 / 无",
        "是否已有教师 / 学生名单或 roster：有 / 无",
        "对接负责人姓名及联系方式：",
        "预计验收时间：",
        "预计正式上线时间：",
    ]
    add_bullets(doc, template_items)


def build_document() -> Document:
    doc = Document()
    configure_document(doc)
    add_title_block(doc)

    add_section(
        doc,
        "一、文档用途与适用范围",
        [
            "本清单用于 SWUFE HotelSim 项目的正式交付准备阶段，适用于“方案 C：正式上线版 / 完整移交版”。该方案的核心目标不是仅完成演示，而是将项目部署到接收方名下的正式环境，并在后续由接收方独立持有、独立管理、独立运营。",
            "对接对象默认为非技术背景的项目负责人、业务负责人、验收人员或学校/单位承接人员。因此本清单尽量使用通俗语言说明“需要准备什么、为什么需要、如果暂时没有可如何过渡”。",
            "如接收方当前尚未具备完整技术资源，也可以先使用过渡方案完成验收，再在验收完成后统一将账号、平台、域名及配置完整移交给接收方。正式上线前，仍建议关键资源最终归属到接收方名下，而不是长期挂在开发方个人账号下。",
        ],
    )

    doc.add_paragraph("二、推荐交付路径", style="Heading 1")
    add_numbered(
        doc,
        [
            "先确认本次确实采用“正式上线版”目标，而不是仅作汇报演示或阶段性内部测试。",
            "由接收方优先准备 Supabase、Vercel、域名三项核心资源；若暂时无法准备，可先采用临时托管方案。",
            "完成数据库、部署平台、域名和环境变量配置后，先部署一套 UAT / 验收环境，不建议直接在生产环境上首轮验收。",
            "使用管理员、教师、学生三类账号跑通完整业务链，包括登录、班级初始化、学生提交、教师处理、结果查看、评分与导出。",
            "验收通过后，再决定是否启用公开注册、邮箱验证、CAPTCHA、告警外发及正式品牌化内容。",
            "最后完成账号归属、域名归属、仓库归属、环境变量归属和运维联系人归属，形成完整移交闭环。",
        ],
    )

    add_table(
        doc,
        "三、接收方必须提供的基础资源",
        ["项目", "是否必须", "用途说明", "如暂时没有，可采用的过渡方案"],
        [
            [
                "Supabase 项目",
                "必须",
                "用于承载数据库、后端存储与后续长期数据归属。正式交付时建议由接收方自己名下账号创建。",
                "可先临时使用开发方测试项目完成演示或验收，但正式上线前必须迁移到接收方名下项目。",
            ],
            [
                "Vercel 部署平台账号",
                "必须",
                "用于部署 Next.js 应用、管理环境变量、查看日志、执行回滚。",
                "可先临时部署到开发方账号，待验收后将项目迁移或重新部署到接收方名下账号。",
            ],
            [
                "正式域名或子域名",
                "强烈建议",
                "用于生成正式访问地址，也关系到认证回调、邮箱链接和对外展示专业度。",
                "验收阶段可先使用临时访问地址，正式上线前再绑定域名。",
            ],
            [
                "Git 仓库或源码接收方式",
                "必须",
                "用于后续代码托管、版本维护、Bug 修复和功能扩展。",
                "若暂时无仓库，可先接收完整源码包，后续再导入正式代码仓库。",
            ],
            [
                "项目对接负责人",
                "必须",
                "负责确认账号、域名、配置、上线窗口和验收反馈，避免交接过程中无人拍板。",
                "如暂未指定，可先由项目经理、老师或业务负责人临时承担。",
            ],
            [
                "真人验收人员",
                "必须",
                "至少需要能代表管理员、教师、学生三种角色完成关键流程验证。",
                "如暂时无正式人员，可先由项目组成员代替完成第一轮验收。",
            ],
        ],
    )

    add_table(
        doc,
        "四、接收方需准备的关键账号与权限",
        ["账号 / 权限", "建议归属", "说明", "备注"],
        [
            [
                "Supabase 管理权限",
                "接收方",
                "用于数据库连接、迁移执行、数据维护和后续独立运维。",
                "建议至少 1 名正式管理员持有。",
            ],
            [
                "Vercel 项目权限",
                "接收方",
                "用于部署、查看日志、管理环境变量和回滚版本。",
                "建议由单位邮箱注册并保留至少 2 名管理员。",
            ],
            [
                "域名 DNS 权限",
                "接收方",
                "用于域名解析、证书配置、后续切换访问地址。",
                "若通过 Cloudflare 管理，也需同步具备对应权限。",
            ],
            [
                "Cloudflare 权限（如使用）",
                "接收方",
                "用于 DNS、代理、WAF、缓存和安全策略。",
                "不是强制项，但若当前域名本身依赖 Cloudflare，则必须协调。",
            ],
            [
                "代码仓库管理权限",
                "接收方",
                "用于未来版本管理、协作开发和交付留档。",
                "建议至少保留开发、测试、运维三个角色的访问边界。",
            ],
        ],
    )

    add_table(
        doc,
        "五、必须提供的环境配置信息",
        ["配置项", "是否必须", "作用说明", "如接收方不熟悉，可采用的方式"],
        [
            ["DATABASE_URL", "必须", "数据库连接地址，用于应用正常读取和写入数据。", "可由开发方协助填写，但建议最终由接收方保存。"],
            ["DIRECT_URL", "必须", "数据库直连地址，主要用于迁移和后台管理。", "可由开发方协助配置。"],
            ["SUPABASE_URL", "必须", "Supabase 项目地址。", "由接收方在 Supabase 项目后台提供。"],
            ["SUPABASE_PUBLISHABLE_KEY", "必须", "前端公开可用的 Supabase Key。", "由接收方在 Supabase 后台复制即可。"],
            ["SUPABASE_SERVICE_ROLE_KEY", "必须", "服务端高级权限密钥，必须妥善保管。", "建议仅由接收方项目管理员持有。"],
            ["NEXTAUTH_URL", "必须", "登录认证与回调所需的正式站点地址。", "验收阶段可先填临时地址，正式上线前再改成正式域名。"],
            ["AUTH_URL", "必须", "认证系统使用的站点地址，通常与 NEXTAUTH_URL 保持一致。", "可由开发方统一配置。"],
            ["NEXTAUTH_SECRET", "必须", "登录会话与认证安全密钥。", "可由开发方代为生成，交付时统一移交给接收方。"],
            ["AUTH_SECRET", "必须", "认证流程使用的安全密钥。", "可由开发方代为生成，交付时统一移交给接收方。"],
        ],
    )

    add_table(
        doc,
        "六、正式上线建议补齐的账号能力与安全能力",
        ["项目", "是否建议上线前具备", "作用说明", "如暂时没有，可采用的过渡方案"],
        [
            [
                "邮件服务（SMTP）",
                "建议具备",
                "用于邮箱验证、密码找回、系统通知。",
                "若暂时没有，可先关闭公开注册，由管理员后台创建账号。",
            ],
            [
                "Turnstile / CAPTCHA",
                "建议具备",
                "用于防止恶意注册、接口滥用和机器刷号。",
                "若暂时没有，可先不开放公开注册，先做内部使用或定向验收。",
            ],
            [
                "外部告警渠道",
                "建议具备",
                "用于当系统出现异常时向邮箱、Webhook 或 Slack 投递提醒。",
                "若暂时没有，可先仅保留系统内告警页面，不影响基本使用。",
            ],
            [
                "密码找回流程",
                "建议具备",
                "正式用户环境中常见的基础能力。",
                "若短期内不需要真实外部用户，可先不开放。",
            ],
            [
                "邮箱验证策略",
                "建议具备",
                "避免大量无效账号进入系统，提升账号管理质量。",
                "验收阶段可先关闭，正式上线再开启。",
            ],
        ],
    )

    add_table(
        doc,
        "七、业务侧必须提供的资料",
        ["资料项", "重要程度", "说明", "备注"],
        [
            [
                "老师最终公式",
                "高",
                "当前系统已预留算法接入点，但如需完全匹配教学设计，仍需老师提供最终业务公式。",
                "这是当前正式业务化的核心待补项之一。",
            ],
            [
                "公式说明文档",
                "高",
                "建议至少说明公式用途、输入项、输出项、单位、参数范围。",
                "便于后续接入、校准和留档。",
            ],
            [
                "学期命名规则",
                "中",
                "用于初始化学期和后续教学期管理。",
                "建议尽量提前统一。",
            ],
            [
                "班级命名规则",
                "中",
                "用于创建班级、导入 roster、后续教师识别。",
                "建议与教学实际一致。",
            ],
            [
                "管理员名单",
                "高",
                "用于确定谁拥有管理端权限。",
                "至少应明确 1 至 2 名正式管理员。",
            ],
            [
                "教师名单",
                "高",
                "用于分配教师端权限和学期所有权。",
                "建议统一整理为表格。",
            ],
            [
                "学生名单或 roster",
                "高",
                "用于导入班级成员、分队或验收准备。",
                "如已有 Excel，可后续转换为 CSV 导入。",
            ],
            [
                "是否保留当前演示数据",
                "中",
                "用于决定上线前是沿用 demo 数据还是切换成正式/半正式数据。",
                "建议在 UAT 阶段前明确。",
            ],
        ],
    )

    add_table(
        doc,
        "八、品牌与展示信息建议提供",
        ["资料项", "建议程度", "说明", "如暂时没有"],
        [
            ["项目正式名称", "建议", "用于首页、页眉、页脚、文档及对外展示。", "可暂用当前项目名。"],
            ["学校 / 课程名称", "建议", "用于形成正式展示口径。", "可后补。"],
            ["Logo", "建议", "用于首页、登录页或文档展示。", "可先沿用文字版标识。"],
            ["品牌主色", "建议", "用于统一视觉风格。", "可先沿用当前界面默认方案。"],
            ["页脚版权或署名文案", "建议", "用于正式上线后的页面收口。", "可后补。"],
            ["对外介绍文案", "可选", "便于宣传、演示、项目介绍。", "可后补。"],
        ],
    )

    add_table(
        doc,
        "九、真人验收阶段接收方需配合提供",
        ["事项", "是否建议必须确认", "说明"],
        [
            ["验收环境", "是", "建议先使用 UAT / 验收环境，不直接在生产环境做首轮可变更验收。"],
            ["管理员验收账号", "是", "至少 1 个。"],
            ["教师验收账号", "是", "至少 1 个。"],
            ["学生验收账号", "是", "建议至少 2 至 4 个。"],
            ["是否允许修改业务数据", "是", "需明确是否允许做初始化 round、提交、处理、评分等操作。"],
            ["验收时间窗口", "是", "便于统一安排环境准备和问题修复。"],
            ["反馈渠道", "是", "建议明确微信群、邮件或文档记录方式。"],
        ],
    )

    doc.add_paragraph("十、常见平替方案与过渡方案", style="Heading 1")
    add_bullets(
        doc,
        [
            "如果接收方暂时没有 Supabase 项目：可由开发方先用临时项目完成部署与验收，待接收方准备好后再迁移数据库归属。",
            "如果接收方暂时没有 Vercel 账号：可由开发方先代为部署，待验收结束后再将项目重新部署到接收方名下平台。",
            "如果接收方暂时没有正式域名：可先使用平台自动生成的临时访问地址做验收，正式上线前再绑定域名。",
            "如果接收方暂时没有邮件服务：可先关闭公开注册与找回密码，仅由管理员统一创建账号。",
            "如果接收方暂时没有 CAPTCHA：可先不开放对外注册，仅限内部账号和内部使用。",
            "如果接收方暂时还没有老师最终公式：可先用现有默认公式完成部署与业务链验收，后续再替换为正式公式并重新校准。",
            "如果接收方暂时没有技术管理员：可由开发方完成一次性环境搭建与文档整理，随后统一移交账号、密码、配置项和操作说明。",
        ],
    )

    doc.add_paragraph("十一、关于“代注册后再完整移交”的建议", style="Heading 1")
    add_bullets(
        doc,
        [
            "若接收方目前时间紧张，开发方可以先协助注册或代管部分平台账号，用于快速完成部署与验收。",
            "但正式上线前，建议尽量将 Supabase、Vercel、域名、Cloudflare 等关键资源转移到接收方名下或由接收方重新注册后接管。",
            "若采用“开发方先代注册，后续完整移交”的方式，建议交接内容至少包括：账号、密码、恢复邮箱、双重验证方式、项目地址、环境变量清单、仓库地址、运维联系人说明。",
            "移交完成后，建议接收方第一时间修改密码并更新安全设置，以确保项目后续控制权完全归属接收方。",
        ],
    )

    doc.add_paragraph("十二、正式上线版的最低准备清单", style="Heading 1")
    add_bullets(
        doc,
        [
            "1 个属于接收方的 Supabase 项目",
            "1 个属于接收方的 Vercel 项目",
            "1 个可长期使用的访问地址（正式域名优先）",
            "1 位明确的项目对接负责人",
            "至少 1 位管理员验收人、1 位教师验收人、2 至 4 位学生验收人",
            "基础环境变量已确认并可写入部署平台",
            "数据库迁移与基础数据初始化方案已确认",
            "已完成至少 1 次完整业务链真人验收",
        ],
    )

    doc.add_paragraph("十三、正式上线前建议必须补齐的内容", style="Heading 1")
    add_bullets(
        doc,
        [
            "邮件服务能力",
            "人机验证能力",
            "老师最终公式",
            "正式域名",
            "运维联系人",
            "外部告警能力（如邮件 / Webhook / Slack）",
            "上线回滚方案和更新责任人",
        ],
    )

    add_reply_template(doc)

    doc.add_paragraph("十六、特别提醒", style="Heading 1")
    add_bullets(
        doc,
        [
            "对于“正式上线版 / 完整移交版”，最重要的原则不是“系统先跑起来”，而是“关键平台和数据归属最终要归到接收方名下”。",
            "若当前确因时间或资源限制，需要先用临时账号、临时域名、临时数据库完成验收，这种做法是可行的；但请务必在正式上线前完成资源归属转移。",
            "如果接收方需要，开发方也可以基于本清单再整理一份更简短的邮件版或一份更正式的盖章式交付说明版。"
        ],
    )

    return doc


def main() -> None:
    output = DEFAULT_OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    document = build_document()
    document.save(output)
    print(output)


if __name__ == "__main__":
    main()
