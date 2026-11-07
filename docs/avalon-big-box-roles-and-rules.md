# 阿瓦隆大盒版（Avalon: Big Box）扩展角色与规则整理

> 整理日期：2026-11-07。范围以 2022 年零售版**阿瓦隆大盒版（Avalon: Big Box）**为准，不把另一款游戏**Quest（另一款游戏，非阿瓦隆）**的亚瑟（Arthur）、摩根勒菲（Morgan le Fay）、盲眼猎人（Blind Hunter）等角色混进来。

## 结论

官方大盒版有**20 张可选角色卡**（加上基础角色后，官方宣传为 23 种不同角色）。20 张可选角色是：

- 旧版阿瓦隆已有：派西维尔（Percival）、莫德雷德（Mordred）、奥伯伦（Oberon）、莫甘娜（Morgana）（4）
- 新的单体角色：捣蛋鬼（Troublemaker）、牧师（Cleric）、不可信的仆人（Untrustworthy Servant）、诡术师（Trickster）、疯子（Lunatic）、莽夫（Brute）、暴露者（Revealer）（7）
- 成套模块角色：正义/邪恶游侠（Good/Evil Rogue）（2）、正义/邪恶兰斯洛特（Good/Evil Lancelot）（2）、正义/邪恶巫师（Good/Evil Sorcerer）（2）、初级/高级/邪恶信使（Junior/Senior/Evil Messenger）（3）

合计 4 + 7 + 2 + 2 + 2 + 3 = 20。

## 角色规则

### 基础特殊角色

| 角色 | 阵营 | 规则 |
|---|---|---|
| 梅林（Merlin） | 好 | 开局看见绝大多数坏人；看不见莫德雷德（Mordred）。好方三次任务成功后仍须躲过刺杀。 |
| 刺客（Assassin） | 坏 | 好方三次任务成功后猜梅林（Merlin）；猜中则坏方翻盘。 |
| 派西维尔（Percival） | 好 | 开局看见梅林（Merlin）；若有莫甘娜（Morgana），则只看见两名“梅林（Merlin）候选”，不知道谁真谁假。 |
| 莫甘娜（Morgana） | 坏 | 在派西维尔（Percival）眼中伪装成梅林（Merlin）。 |
| 莫德雷德（Mordred） | 坏 | 梅林（Merlin）看不见他。 |
| 奥伯伦（Oberon） | 坏 | 不认识其他坏人，其他坏人也看不见他；梅林（Merlin）仍能看见他。 |

### 大盒版单体新角色

| 角色 | 阵营 | 卡面能力／规则 | 对线上版的影响 |
|---|---|---|---|
| 疯子（Lunatic） | 坏 | **参加任务时必须出失败（Fail）**。 | 强制禁用成功（Success）。 |
| 莽夫（Brute） | 坏 | **只有前 3 个任务可以出失败（Fail）**；第 4、5 个任务只能成功（Success）。 | 按任务编号限制出牌。 |
| 暴露者（Revealer） | 坏 | **第二个失败任务结算后公开自己的身份／阵营**。 | 自动全房公告。 |
| 牧师（Cleric） | 好 | **秘密查验第一任队长的阵营**。 | 开局只向牧师（Cleric）显示结果。 |
| 诡术师（Trickster） | 坏 | 接受忠诚查验时**可以谎报阵营**。 | 湖中仙女/牧师/相关阴谋卡查验需让其选择显示结果。 |
| 捣蛋鬼（Troublemaker） | 好 | 接受忠诚查验时**必须谎报阵营**（显示为坏）。 | 查验结果强制反转。 |
| 不可信的仆人（Untrustworthy Servant） | 初始好 | 在梅林（Merlin）眼中显示为坏；知道刺客（Assassin）；在**招募阶段（Recruitment stage）**可能转为坏方。 | 需要单独实现招募阶段和动态阵营。不要只当普通好人。 |

> 出版商网页文案写过“欺诈者（Deceiver）”，但零售版组件清单、实物卡与 BGG 逐项清单对应的是**捣蛋鬼（Troublemaker）**；开发应以实际大盒版卡组为准，并把这个命名差异记录下来。

### 巫师（Sorcerers）（必须成对使用）

- **正义巫师（Good Sorcerer）**：好方，可出成功（Success）或魔法牌（Magic）。
- **邪恶巫师（Evil Sorcerer）**：坏方，可出成功（Success）或魔法牌（Magic），**不能出普通失败（Fail）**。
- **魔法牌（Magic）**会把该次任务原本的成败结论反转：原本成功则失败，原本失败则成功。
- 两张魔法牌（Magic）同局出现时应按规则书确定叠加方式；实现前需用正式规则书复核奇偶反转细节。

### 兰斯洛特（Lancelots）（必须成对使用）

角色为**正义兰斯洛特（Good Lancelot）**与**邪恶兰斯洛特（Evil Lancelot）**。核心是两人的当前阵营可能一起交换，身份牌名称不换。

常见三套官方／促销规则：

1. **规则 1（Rule 1）**：5 张忠诚牌（2 换阵营（Switch）、3 不换（No Switch））。从第 3 个任务开始，每次进入组队阶段翻一张；同一任务投票否决后重新组队也再翻。翻完为止。
2. **规则 2（Rule 2）**：7 张洗混（2 换阵营（Switch）、5 不换（No Switch）），只使用顶部 5 张；从第 1 个任务开始，每个任务开始翻一张。
3. **规则 3（Rule 3）**：永不换阵营，但两名兰斯洛特（Lancelot）开局互相认识。

视野随当前阵营处理：梅林（Merlin）通常看见当前邪恶兰斯洛特（Evil Lancelot）；普通坏人也看见邪恶兰斯洛特（Evil Lancelot）（奥伯伦例外）。最终胜负按当时阵营判断。

### 游侠（Rogues）（必须成对使用）

- **正义游侠（Good Rogue）**：好方但不被坏人识别，可打专属**游侠成功牌（Rogue Success）**。
- **邪恶游侠（Evil Rogue）**：坏方但不被其他坏人识别，可打专属**游侠失败牌（Rogue Fail）**。
- 两人有区别于所属阵营的个人获胜条件；盒中为此提供 5 个游侠成功牌（Rogue Success）、5 个游侠失败牌（Rogue Fail）和监视标记（Watch token）。
- 专属牌会暴露“场上有游侠（Rogue）做过动作”，并让游侠（Rogue）争取个人完整胜利；仅所属阵营获胜但未完成游侠（Rogue）条件时并非完整胜利。
- 个人胜利所需次数及监视标记（Watch token）的精确流程应照正式规则书录入，不应凭概述硬编码。

### 信使（Messengers）（3 人模块）

- **初级信使（Junior Messenger）（好）**：可出正义信件（Good Message）。
- **高级信使（Senior Messenger）（好）**：知道初级信使（Junior Messenger），可出正义信件（Good Message）。
- **邪恶信使（Evil Messenger）（坏）**：可出邪恶信件（Evil Message）。
- 盒中有 4 个正义信件（Good Message）、2 个邪恶信件（Evil Message） token。前面任务打出的信件（Message）会被收集，并在最终任务提供优势／增援，可能改变最后任务的结果。
- 最终任务的触发阈值与结算顺序需按正式规则书实现。

## 非角色模块

### 湖中仙女（Lady of the Lake）

- 首任持有人通常是第一任队长右手边玩家。
- 第 2、3、4 个任务后使用；持有人秘密查看一名尚未持有过湖中仙女的玩家的阵营，然后把湖中仙女交给该玩家。
- 不能查自己或曾持有过湖中仙女的人；公开的是“查了谁”，结果只给使用者。

### 王者之剑（Excalibur）

- 队长组队时把王者之剑（Excalibur）交给一名任务队员（通常不能给自己，并且持有人也是任务成员）。
- 任务牌结算前，持有人可指定另一名任务成员，将其任务牌翻转（Success ↔ Fail），或选择不用。
- 目标与原牌面属于敏感信息，线上版不能提前泄露给其他人。

### 陷阱师（Trapper）

- 使用组队标记（Team token），**让任务队伍比通常人数多 1 人**，再按陷阱师（Trapper）流程排除／处理其中一人的任务贡献。
- 精确选择时点和公开信息必须按规则书复核后实现。

### 阴谋卡（Plot Cards）（15 张）

每个任务开始时由队长（Leader）抽取并交给玩家，分三类：

- 队长（Leader）图标：立即结算；
- 鸢尾花（Fleur-de-lis）图标：持有到玩家主动使用；
- 花（Flower）图标：整局持续生效。

能力包括查验忠诚、强制公开任务牌、改变下任队长、转移阴谋卡等。线上实现需要逐卡建模，不能只做一张通用卡。

## 建议开发顺序

1. **低复杂度角色**：疯子（Lunatic）、莽夫（Brute）、暴露者（Revealer）、牧师（Cleric）、诡术师（Trickster）、捣蛋鬼（Troublemaker）。
2. **成熟模块**：湖中仙女（Lady of the Lake）、王者之剑（Excalibur）、兰斯洛特（Lancelot）。
3. **需增加新阶段／动态阵营**：不可信的仆人（Untrustworthy Servant）。
4. **需专属牌和独立胜利逻辑**：巫师（Sorcerers）、游侠（Rogues）、信使（Messengers）、陷阱师（Trapper）。
5. **最后做阴谋卡（Plot Cards）**：15 张都需要独立状态机与权限检查。

## 资料来源与可靠性

- 出版商官方产品页：<https://indieboardsandcards.com/our-games/avalon-big-box/>
- BGG Big Box 文件清单／组件与角色逐项综述（thread 2987757）：<https://boardgamegeek.com/thread/2987757/enders-comprehensive-pictorial-review-the-definiti>
- BGG 收录的官方规则书扫描件条目（filepage 306219）：<https://boardgamegeek.com/filepage/306219/avalon-big-box-rulebook-english>
- 角色实物卡面与 Big Box 规则讲解视频交叉核对：<https://www.youtube.com/watch?v=PWHrNMmnetc>
- 兰斯洛特/湖中仙女/王者之剑（Lancelot/Lady/Excalibur）的状态机细节还与开源规则引擎 `@avalon-app/core` 交叉核对；它是二手实现，不替代正式规则书。

## 开发前仍需从正式规则书逐字确认的四处

1. 不可信的仆人（Untrustworthy Servant）的招募阶段（Recruitment stage） 谁选择、何时选择；
2. 游侠（Rogue）的完整胜利阈值与监视标记（Watch token）流程；
3. 信使（Messenger）最终任务的标记（token） 阈值和结算顺序；
4. 陷阱师（Trapper）具体排除任务牌的时点，以及多张魔法牌（Magic）的叠加规则。

以上位置资料概述不足，我没有把猜测伪装成确定规则。其余角色身份与卡面能力已交叉核对。