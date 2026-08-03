# 公式校准说明

本次校准目标不是把酒店经营完全拟真，而是在现有 Web 比赛系统中建立一套更科学、可解释、可复现、可继续替换的运行基线。

## 本轮重点调整

1. 价格与需求

- 将价格影响从简单线性改为“相对默认价格的弹性响应 + 过度折价的软惩罚”。
- 这样做的原因是酒店价格调整通常不会无限放大需求，深度折价还会损害净收入与品牌完整性。

2. 渠道与净收入

- 保留渠道适配度对需求的影响，同时新增渠道获客成本逻辑。
- 这样总收入与净收入之间不再只靠一个粗略比例，而是体现“OTA/代理/GDS 会带来更高获客摩擦”。

3. 附加收入

- 将餐饮与其他收入从固定比例，改为与团队客占比、入住率、满意度、品牌和技术水平联动。
- 这样更接近全服务型酒店中 `TRevPAR` 相对 `RevPAR` 的扩展关系。

4. 成本结构

- 将运营成本拆成客房部门、餐饮部门、公用工程、后台支持和渠道获客成本。
- 同时让能源效率对水电成本有可解释的节约作用。

5. ESG

- 下调 ESG 对需求的直接正向拉动。
- ESG 仍然影响品牌、成本、员工与长期稳定性，但不再被当作强力拉客按钮。

6. 风险惩罚

- 新增现金、杠杆、营销分配不一致、渠道配比不一致、激进税务与低满意度压力等惩罚项。
- 这样比赛结果不只奖励“冲收入”，也会约束明显不合理的经营组合。

7. 评分目标

- 将默认评分快照调到更接近“500 间左右城市型全服务酒店”的中位经营区间。
- 当前默认目标并非绝对行业真值，而是基于公开资料后的教学竞赛化校准值。

## 主要参考资料

以下资料用于确定“方向”和“合理区间”，不是机械照搬为唯一数值：

1. CoStar / STR

- `RevPAR vs. TRevPAR`
  https://www.costar.com/products/str-benchmark/resources/data-insights-blog/revpar-vs-trevpar
- `Understanding your STR Reports: Profit & Loss`
  https://www.costar.com/products/benchmark/resources/data-insights-blog/understanding-your-str-reports-profit-loss-pl

2. Cornell School of Hotel Administration / Cornell Chronicle

- `The Impact of Social Media on Lodging Performance`
  https://ecommons.cornell.edu/bitstreams/3c8d009a-2ff5-4435-afc2-687c0a2a2a67/download
- `The Hotel Industry's Achilles Heel? Quantifying the Negative Impacts of Hotel Room Discounting`
  https://ecommons.cornell.edu/items/9f93a2c4-7605-4e51-8f82-5539aaaa41a6
- `Hotel Industry Demand Curves: A New Teaching Tool`
  https://ecommons.cornell.edu/bitstream/1813/72477/1/Corgel107_Hotel_industry.pdf
- `Hotels' green efforts don't affect revenues`
  https://news.cornell.edu/stories/2013/11/hotels-green-efforts-don-t-affect-revenues
- `New study reveals value of investing in service employees`
  https://news.cornell.edu/stories/2015/01/new-study-reveals-value-investing-service-employees
- `The Effect of Hotel Renovations on Operating Performance`
  https://ecommons.cornell.edu/items/24f7adbe-4f24-4402-bc7b-23dbf4b19f70

3. ENERGY STAR / U.S. EPA

- `Hotel and Motel Energy Performance`
  https://www.energystar.gov/ia/partners/publications/pubdocs/Hotel.pdf

## 当前仍属“工程假设”的部分

以下内容已经尽量做成可调、可替换，但仍建议未来用赛事样本继续校准：

- 各渠道的精确获客成本率
- 各细分市场的最终价格弹性数值
- 附加收入占比的学校/赛题特定结构
- 杠杆风险与现金风险的惩罚强度
- 不同赛道下评分权重与目标值

## 当前验证状态

已完成：

- 单元测试通过
- balance test 通过
- 平均入住率、附加收入占比、GOP 利润率、收入差异度、惩罚分布已落在当前基准阈值内

建议后续继续做：

- 用真实赛事样本或老师案例做参数反推
- 按酒店类型拆分规则集，如商务型、会议型、度假型
- 将渠道成本率、价格弹性、评分目标做成后台可配置规则项
