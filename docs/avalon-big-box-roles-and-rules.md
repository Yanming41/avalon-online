# Avalon: Big Box 扩展角色与规则整理

> 整理日期：2026-11-07。范围以 2022 年零售版 **Avalon: Big Box** 为准，不把另一款游戏 **Quest** 的 Arthur、Morgan le Fay、Blind Hunter 等角色混进来。

## 结论

官方 Big Box 有 **20 张可选角色卡**（加上基础角色后，官方宣传为 23 种 distinct characters）。20 张可选角色是：

- 旧版 Avalon 已有：Percival、Mordred、Oberon、Morgana（4）
- 新的单体角色：Troublemaker、Cleric、Untrustworthy Servant、Trickster、Lunatic、Brute、Revealer（7）
- 成套模块角色：Good/Evil Rogue（2）、Good/Evil Lancelot（2）、Good/Evil Sorcerer（2）、Junior/Senior/Evil Messenger（3）

合计 4 + 7 + 2 + 2 + 2 + 3 = 20。

## 角色规则

### 基础特殊角色

| 角色 | 阵营 | 规则 |
|---|---|---|
| Merlin | 好 | 开局看见绝大多数坏人；看不见 Mordred。好方三次任务成功后仍须躲过刺杀。 |
| Assassin | 坏 | 好方三次任务成功后猜 Merlin；猜中则坏方翻盘。 |
| Percival | 好 | 开局看见 Merlin；若有 Morgana，则只看见两名“Merlin 候选”，不知道谁真谁假。 |
| Morgana | 坏 | 在 Percival 眼中伪装成 Merlin。 |
| Mordred | 坏 | Merlin 看不见他。 |
| Oberon | 坏 | 不认识其他坏人，其他坏人也看不见他；Merlin 仍能看见他。 |

### Big Box 单体新角色

| 角色 | 阵营 | 卡面能力／规则 | 对线上版的影响 |
|---|---|---|---|
| Lunatic | 坏 | **参加任务时必须出 Fail**。 | 强制禁用 Success。 |
| Brute | 坏 | **只有前 3 个任务可以出 Fail**；第 4、5 个任务只能 Success。 | 按任务编号限制出牌。 |
| Revealer | 坏 | **第二个失败任务结算后公开自己的身份／阵营**。 | 自动全房公告。 |
| Cleric | 好 | **秘密查验第一任队长的阵营**。 | 开局只向 Cleric 显示结果。 |
| Trickster | 坏 | 接受忠诚查验时**可以谎报阵营**。 | Lady/Cleric/相关 Plot 查验需让其选择显示结果。 |
| Troublemaker | 好 | 接受忠诚查验时**必须谎报阵营**（显示为坏）。 | 查验结果强制反转。 |
| Untrustworthy Servant | 初始好 | 在 Merlin 眼中显示为坏；知道 Assassin；在 **Recruitment stage** 可能转为坏方。 | 需要单独实现招募阶段和动态阵营。不要只当普通好人。 |

> 出版商网页文案写过 “Deceiver”，但零售版组件清单、实物卡与 BGG 逐项清单对应的是 **Troublemaker**；开发应以实际 Big Box 卡组为准，并把这个命名差异记录下来。

### Sorcerers（必须成对使用）

- **Good Sorcerer**：好方，可出 Success 或 Magic。
- **Evil Sorcerer**：坏方，可出 Success 或 Magic，**不能出普通 Fail**。
- **Magic** 会把该次任务原本的成败结论反转：原本成功则失败，原本失败则成功。
- 两张 Magic 同局出现时应按规则书确定叠加方式；实现前需用正式规则书复核奇偶反转细节。

### Lancelots（必须成对使用）

角色为 **Good Lancelot** 与 **Evil Lancelot**。核心是两人的当前阵营可能一起交换，身份牌名称不换。

常见三套官方／促销规则：

1. **Rule 1**：5 张忠诚牌（2 Switch、3 No Switch）。从第 3 个任务开始，每次进入组队阶段翻一张；同一任务投票否决后重新组队也再翻。翻完为止。
2. **Rule 2**：7 张洗混（2 Switch、5 No Switch），只使用顶部 5 张；从第 1 个任务开始，每个任务开始翻一张。
3. **Rule 3**：永不换阵营，但两名 Lancelot 开局互相认识。

视野随当前阵营处理：Merlin 通常看见当前 Evil Lancelot；普通坏人也看见 Evil Lancelot（Oberon 例外）。最终胜负按当时阵营判断。

### Rogues（必须成对使用）

- **Good Rogue**：好方但不被坏人识别，可打专属 **Rogue Success**。
- **Evil Rogue**：坏方但不被其他坏人识别，可打专属 **Rogue Fail**。
- 两人有区别于所属阵营的个人获胜条件；盒中为此提供 5 个 Rogue Success、5 个 Rogue Fail 和 Watch token。
- 专属牌会暴露“场上有 Rogue 做过动作”，并让 Rogue 争取个人完整胜利；仅所属阵营获胜但未完成 Rogue 条件时并非完整胜利。
- 个人胜利所需次数及 Watch token 的精确流程应照正式规则书录入，不应凭概述硬编码。

### Messengers（3 人模块）

- **Junior Messenger（好）**：可出 Good Message。
- **Senior Messenger（好）**：知道 Junior Messenger，可出 Good Message。
- **Evil Messenger（坏）**：可出 Evil Message。
- 盒中有 4 个 Good Message、2 个 Evil Message token。前面任务打出的 Message 会被收集，并在最终任务提供优势／增援，可能改变最后任务的结果。
- 最终任务的触发阈值与结算顺序需按正式规则书实现。

## 非角色模块

### Lady of the Lake

- 首任持有人通常是第一任队长右手边玩家。
- 第 2、3、4 个任务后使用；持有人秘密查看一名尚未持有过 Lady 的玩家的阵营，然后把 Lady 交给该玩家。
- 不能查自己或曾持有过 Lady 的人；公开的是“查了谁”，结果只给使用者。

### Excalibur

- 队长组队时把 Excalibur 交给一名任务队员（通常不能给自己，并且持有人也是任务成员）。
- 任务牌结算前，持有人可指定另一名任务成员，将其任务牌翻转（Success ↔ Fail），或选择不用。
- 目标与原牌面属于敏感信息，线上版不能提前泄露给其他人。

### Trapper

- 使用 Team token，**让任务队伍比通常人数多 1 人**，再按 Trapper 流程排除／处理其中一人的任务贡献。
- 精确选择时点和公开信息必须按规则书复核后实现。

### Plot Cards（15 张）

每个任务开始时由 Leader 抽取并交给玩家，分三类：

- Leader 图标：立即结算；
- Fleur-de-lis 图标：持有到玩家主动使用；
- Flower 图标：整局持续生效。

能力包括查验忠诚、强制公开任务牌、改变下任队长、转移 Plot 等。线上实现需要逐卡建模，不能只做一张通用卡。

## 建议开发顺序

1. **低复杂度角色**：Lunatic、Brute、Revealer、Cleric、Trickster、Troublemaker。
2. **成熟模块**：Lady of the Lake、Excalibur、Lancelot。
3. **需增加新阶段／动态阵营**：Untrustworthy Servant。
4. **需专属牌和独立胜利逻辑**：Sorcerers、Rogues、Messengers、Trapper。
5. **最后做 Plot Cards**：15 张都需要独立状态机与权限检查。

## 资料来源与可靠性

- 出版商官方产品页：<https://indieboardsandcards.com/our-games/avalon-big-box/>
- BGG Big Box 文件清单／组件与角色逐项综述（thread 2987757）：<https://boardgamegeek.com/thread/2987757/enders-comprehensive-pictorial-review-the-definiti>
- BGG 收录的官方规则书扫描件条目（filepage 306219）：<https://boardgamegeek.com/filepage/306219/avalon-big-box-rulebook-english>
- 角色实物卡面与 Big Box 规则讲解视频交叉核对：<https://www.youtube.com/watch?v=PWHrNMmnetc>
- Lancelot/Lady/Excalibur 的状态机细节还与开源规则引擎 `@avalon-app/core` 交叉核对；它是二手实现，不替代正式规则书。

## 开发前仍需从正式规则书逐字确认的四处

1. Untrustworthy Servant 的 Recruitment stage 谁选择、何时选择；
2. Rogue 的完整胜利阈值与 Watch token 流程；
3. Messenger 最终任务的 token 阈值和结算顺序；
4. Trapper 具体排除任务牌的时点，以及多张 Magic 的叠加规则。

以上位置资料概述不足，我没有把猜测伪装成确定规则。其余角色身份与卡面能力已交叉核对。