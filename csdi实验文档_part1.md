# CSDI 实验文档：Stage 模型与分布式计算器功能扩展分析

## 一、实验背景

本实验基于 `DistributedCalcExample` 分布式计算器工程展开。该工程采用 HarmonyOS Stage 模型，通过 `UIAbility` 承载主界面，通过 `Want` 拉起远端设备上的同一 Ability，并结合分布式 KVStore 实现多设备间表达式同步。

在任务 2 的功能扩展中，计算器在原有加、减、乘、除基础上新增了以下功能：

- 平方：如 `5² = 25`
- 百分号：如 `50% = 0.5`
- 括号：如 `(7*4+8)*2 = 72`
- 开方：如 `√9 = 3`

因此，本实验文档一方面说明 Stage 模型中的 `UIAbility`、`ExtensionAbility`、`Want`、`Context` 等核心概念，另一方面结合本项目代码说明这些概念在实际开发中的使用方式。

## 二、Stage 模型整体结构

Stage 模型是 HarmonyOS 应用当前主流的应用模型。它将应用分为 `Application`、`AbilityStage`、`UIAbility`、`ExtensionAbility` 等层次，使应用生命周期、窗口管理、后台能力和跨设备能力更加清晰。

本项目的模块配置文件为：

```text
entry/src/main/module.json5
```

其中关键配置如下：

```json5
{
  "srcEntry": "./ets/Application/MyAbilityStage.ts",
  "mainElement": "MainAbility",
  "abilities": [
    {
      "name": "MainAbility",
      "srcEntry": "./ets/MainAbility/MainAbility.ts",
      "launchType": "singleton"
    }
  ]
}
```

这说明应用入口采用 Stage 模型，模块启动时先进入 `AbilityStage`，主入口 Ability 是 `MainAbility`，其具体实现位于：

```text
entry/src/main/ets/MainAbility/MainAbility.ts
```

## 三、UIAbility 概念与生命周期管理

`UIAbility` 是带界面的应用组件，负责管理页面窗口、前后台状态和应用主界面的生命周期。简单理解，`UIAbility` 是 Stage 模型中用户可见界面的承载单元。

本项目中的 `MainAbility` 继承自 `UIAbility`：

```ts
export default class MainAbility extends UIAbility {
  onCreate(want, launchParam) {
    AppStorage.setOrCreate('UIAbilityContext', this.context)
    let isRemote = want.parameters.isRemote
    if (isRemote) {
      AppStorage.setOrCreate('isRemote', isRemote)
    }
  }

  onWindowStageCreate(windowStage) {
    windowStage.loadContent("pages/Index", ...)
  }

  onForeground() {}
  onBackground() {}
  onDestroy() {}
}
```

### 1. onCreate

`onCreate` 在 Ability 创建时调用。项目中主要完成两件事：

- 将当前 `UIAbilityContext` 存入 `AppStorage`
- 读取 `Want` 中传递的 `isRemote` 参数，判断当前 Ability 是否由远端设备拉起

代码位置：

```text
entry/src/main/ets/MainAbility/MainAbility.ts
```

实际代码中：

```ts
AppStorage.setOrCreate('UIAbilityContext', this.context)
let isRemote = want.parameters.isRemote
if (isRemote) {
  AppStorage.setOrCreate('isRemote', isRemote)
}
```

这里体现了 `UIAbility` 与 `Want`、`Context` 的联系：Ability 被启动时可以接收 `Want`，同时 Ability 自身提供 `context`，后续 UI 页面或组件可以通过该上下文访问资源、启动其他 Ability 或申请权限。

### 2. onWindowStageCreate

`onWindowStageCreate` 在窗口创建时调用。项目中通过：

```ts
windowStage.loadContent("pages/Index", ...)
```

加载主页面 `Index.ets`。因此，`MainAbility` 本身不直接写计算器界面，而是负责创建窗口并加载 ArkUI 页面。

### 3. onForeground 与 onBackground

`onForeground` 和 `onBackground` 分别表示 Ability 进入前台和后台。当前项目中主要记录日志，但在实际开发中可以在这里处理：

- 页面恢复显示时刷新数据
- 应用进入后台时暂停任务
- 保存临时状态
- 停止不必要的设备发现或网络操作

### 4. onDestroy

`onDestroy` 表示 Ability 销毁。项目中记录日志。配合页面中的 `aboutToDisappear`，可以进行资源释放。

例如 `Index.ets` 中：

```ts
aboutToDisappear() {
  this.kvStoreModel.deleteKvStore()
}
```

这体现了生命周期管理不仅存在于 Ability 层，也存在于页面组件层。

## 四、Want：Ability 间启动与数据传递

`Want` 是 HarmonyOS 中描述“想要执行什么操作”的数据结构，常用于启动 Ability、传递参数、指定目标设备等。

本项目中，`Want` 的典型使用位置在：

```text
entry/src/main/ets/common/TitleBarComponent.ets
```

远端设备选择完成后，应用通过 `startAbility` 拉起另一台设备上的 `MainAbility`：

```ts
let want: Want = {
  bundleName: BUNDLE_NAME,
  abilityName: 'MainAbility',
  deviceId: deviceId,
  parameters: {
    isRemote: 'isRemote'
  }
}
context.startAbility(want)
```

这里的 `Want` 包含四类重要信息：

- `bundleName`：目标应用包名，本项目为 `ohos.samples.distributedcalc`
- `abilityName`：目标 Ability 名称，即 `MainAbility`
- `deviceId`：目标远端设备 ID
- `parameters`：传递给目标 Ability 的自定义参数

当远端设备上的 `MainAbility` 启动后，会在 `onCreate(want, launchParam)` 中读取：

```ts
let isRemote = want.parameters.isRemote
```

然后将 `isRemote` 存入 `AppStorage`。主页面 `Index.ets` 再通过：

```ts
let isRemote: string | undefined = AppStorage.get('isRemote')
```

判断当前实例是否是远端拉起实例，从而显示不同状态并参与分布式同步。

这说明 `Want` 不只是启动组件的工具，也可以作为跨 Ability、跨设备传递启动参数的载体。

## 五、Context：上下文对象的作用

`Context` 表示当前组件或 Ability 所处的运行环境。通过 `Context`，应用可以获取资源、申请权限、启动 Ability、终止自身、创建系统服务对象等。

本项目中常见的 `Context` 使用方式有以下几种。

### 1. 在 UIAbility 中保存 Context

在 `MainAbility.ts` 中：

```ts
AppStorage.setOrCreate('UIAbilityContext', this.context)
```

这样做的目的是让页面或组件在需要时可以从 `AppStorage` 中取出上下文对象。

例如 `TitleBarComponent.ets` 中获取本机名称：

```ts
let context: common.UIAbilityContext | undefined = AppStorage.get('UIAbilityContext')
context.resourceManager.getStringSync($r('app.string.localhost').id)
```

### 2. 在组件中通过 getContext 获取 Context

在 `TitleBarComponent.ets` 中：

```ts
let context = getContext(this) as common.UIAbilityContext
context.startAbility(want)
```

这里通过当前组件获取 `UIAbilityContext`，然后调用 `startAbility` 启动远端 Ability。

### 3. 使用 Context 申请权限

在 `Index.ets` 的 `aboutToAppear` 中：

```ts
let context = getContext(this) as common.UIAbilityContext
let atManager = abilityAccessCtrl.createAtManager()
atManager.requestPermissionsFromUser(context, ['ohos.permission.DISTRIBUTED_DATASYNC'])
```

这说明权限申请需要依赖当前 Ability 的上下文。

### 4. 使用 Context 创建分布式 KVStore

在 `KvStoreModel.ets` 中：

```ts
let config: distributedData.KVManagerConfig = {
  bundleName: BUNDLE_NAME,
  context: context
};
this.kvManager = distributedData.createKVManager(config);
```

分布式数据管理需要知道当前应用上下文，才能创建对应应用空间内的 KVManager。

## 六、分布式能力在项目中的实现

本项目的分布式能力主要由两部分组成：

- 远端设备发现与认证：`RemoteDeviceModel.ets`
- 表达式数据同步：`KvStoreModel.ets`

### 1. 远端设备发现

代码位置：

```text
entry/src/main/ets/model/RemoteDeviceModel.ets
```

该类通过：

```ts
deviceManager.createDeviceManager(BUNDLE_NAME)
```

创建设备管理对象，并监听：

- `deviceStateChange`
- `discoverSuccess`
- `discoverFailure`
- `serviceDie`

当发现设备后，设备会加入 `discoverList`，随后由 `DeviceDialog` 展示给用户选择。

### 2. 远端设备认证与拉起

当用户选择远端设备后，`RemoteDeviceModel.authenticateDevice` 会调用设备绑定能力。认证完成后，`TitleBarComponent` 调用：

```ts
context.startAbility(want)
```

将远端设备上的 `MainAbility` 拉起。

### 3. 表达式同步

代码位置：

```text
entry/src/main/ets/model/KvStoreModel.ets
```

项目通过分布式 KVStore 存储和同步表达式：

```ts
this.kvStore.put(key, value)
this.kvStore.sync(deviceIds, distributedData.SyncMode.PUSH_PULL, 1000)
```

在 `Index.ets` 中，`expression` 被设置为带监听的状态：

```ts
@State @Watch('dataChange') expression: string = ''
```

每当本地表达式变化时：

```ts
this.kvStoreModel.put(DATA_CHANGE, this.expression)
```

远端设备收到数据变化后再更新自己的 `expression` 和 `result`。这就是“协同计算”的核心。

## 七、本次任务 2 功能扩展说明

本次在原有四则运算基础上新增了平方、百分号、括号和开方功能。改动主要分为三层。

### 1. 计算模型层

代码位置：

```text
entry/src/main/ets/model/Calculator.ts
```

新增了：

```ts
export function square(inputContent: string): string
export function percent(inputContent: string): string
export function squareRoot(inputContent: string): string
```

同时修复了括号解析逻辑。原来的中缀表达式转后缀表达式逻辑在处理括号时，会在遇到低优先级运算符时错误弹出左括号，导致 `(7*4+8)` 这类表达式计算失败。修复后，遇到右括号时只弹出到左括号为止，遇到普通运算符时不会把左括号弹出。

验证表达式包括：

```text
(7*4+8) = 36
(7*4+8)*2 = 72
7*(4+8) = 84
50% = 0.5
√9 = 3
5² = 25
```

### 2. 页面输入控制层

代码位置：

```text
entry/src/main/ets/pages/Index.ets
```

新增了以下输入控制逻辑：

- `S`：平方
- `%`：百分号
- `R`：开方
- `(`、`)`：括号

为了避免用户输入未闭合括号时直接触发错误计算，页面层新增了：

```ts
getExpressionForCalc(expression: string): string
isGroupingBalanced(expression: string): boolean
handleGrouping(value: string)
```

这几个方法用于判断表达式是否可计算，以及括号是否匹配。

此外，为了改善实际输入体验，还支持：

- 输入 `7*4+8` 后点击 `)`，自动变为 `(7*4+8)`
- 在右括号后直接输入数字，自动补乘号，例如 `(7*4+8)2` 按 `(7*4+8)*2` 处理

### 3. UI 按钮层

代码位置：

```text
entry/src/main/ets/model/ImageList.ets
entry/src/main/ets/common/ButtonComponent.ets
entry/src/main/ets/common/ButtonComponentHorizontal.ets
```

新增功能按钮列表：

```ts
obtainImgFunctions()
```

包含：

- `%`
- `(`
- `)`
- `R`，表示开方

竖屏和横屏按钮布局都扩展为 6 列，使新增功能在两种方向下都可以使用。

新增图标资源包括：

```text
ic_cal_square.svg
ic_cal_percent_blue.svg
ic_cal_left_parenthesis.svg
ic_cal_right_parenthesis.svg
ic_cal_sqrt.svg
```

### 4. 测试用例层

代码位置：

```text
entry/src/ohosTest/ets/test/app.test.ets
```

新增测试：

- `Square_001`
- `Percent_001`
- `Parentheses_001`
- `SquareRoot_001`

其中括号测试使用了：

```text
(7*4+8)*2 = 72
```

可以覆盖右括号输入、括号表达式计算和右括号后的后续运算。

## 八、ExtensionAbility 与卡片能力说明

`ExtensionAbility` 是 Stage 模型中除 `UIAbility` 外的扩展能力组件。它通常不直接显示完整页面，而是用于提供某类后台或嵌入式能力。例如：

- `FormExtensionAbility`：桌面服务卡片
- `ServiceExtensionAbility`：后台服务
- `DataShareExtensionAbility`：数据共享
- `FileAccessExtensionAbility`：文件访问扩展

本项目当前没有实现 `ExtensionAbility` 或卡片功能。原因是本项目的核心目标是“分布式计算器”，主要关注：

- UI 界面显示
- 远端 Ability 拉起
- 分布式数据同步
- 计算表达式处理

这些需求通过 `UIAbility + Want + Context + KVStore` 已经可以完成。

如果要为本计算器增加桌面卡片，可以新增一个 `FormExtensionAbility`，实现思路如下：

1. 在 `module.json5` 中增加 `extensionAbilities` 配置，声明卡片扩展能力。
2. 新建 `FormExtensionAbility` 类，处理卡片创建、更新、销毁等生命周期。
3. 设计卡片页面，例如展示最近一次计算表达式和结果。
4. 通过数据持久化或 KVStore，把主应用中的计算结果同步给卡片。
5. 卡片被点击时，可以通过 `Want` 拉起 `MainAbility`，并传递参数，例如打开计算器首页或恢复最近表达式。

如果结合当前项目，可设计为：

```text
桌面卡片显示：最近表达式 = (7*4+8)*2
桌面卡片显示：最近结果 = 72
点击卡片：通过 Want 启动 MainAbility
```

这样就能把 `ExtensionAbility` 与现有的 `UIAbility`、`Want`、`Context` 和 KVStore 机制联系起来。

## 九、概念对照总结

| 概念 | 作用 | 本项目中的体现 |
| --- | --- | --- |
| `UIAbility` | 承载可见界面，管理窗口和生命周期 | `MainAbility.ts` 加载 `pages/Index` |
| `Want` | 描述启动目标和传递参数 | `TitleBarComponent.ets` 使用 `Want` 拉起远端 `MainAbility` |
| `Context` | 表示运行上下文，可访问资源、权限、Ability 启动等 | `getContext(this)`、`this.context`、KVManager 创建 |
| `AppStorage` | 应用级状态共享 | 保存 `UIAbilityContext`、`isRemote`、`deviceList` |
| `ExtensionAbility` | 提供卡片、服务、数据共享等扩展能力 | 当前项目未实现，可扩展为桌面卡片 |
| 分布式设备管理 | 发现、认证、监听远端设备 | `RemoteDeviceModel.ets` |
| 分布式 KVStore | 多设备同步表达式 | `KvStoreModel.ets` |
| 页面状态管理 | 表达式和结果的响应式更新 | `Index.ets` 中的 `@State`、`@Watch` |

## 十、实验结论

通过本项目可以看到，Stage 模型并不是单纯的页面组织方式，而是一套完整的应用运行模型。`UIAbility` 负责应用界面和生命周期，`Want` 负责 Ability 启动与参数传递，`Context` 提供系统能力访问入口，分布式设备管理和 KVStore 则进一步支持跨设备协同。

在任务 2 的功能扩展中，平方、百分号、括号和开方功能主要修改了计算模型、页面输入逻辑和按钮布局。虽然这些功能属于计算器业务逻辑，但它们仍然依赖 Stage 模型提供的页面状态管理、生命周期和分布式同步机制。尤其是 `expression` 的变化会通过 `@Watch` 写入 KVStore，并同步到远端设备，因此新增功能不仅影响本地计算，也会影响分布式协同计算结果。

因此，本实验加深了对以下内容的理解：

- `UIAbility` 如何创建、显示和销毁界面
- `Want` 如何启动远端 Ability 并传递参数
- `Context` 如何连接应用代码与系统能力
- 分布式设备发现、认证和数据同步的基本流程
- 业务功能扩展如何与 Stage 模型中的状态管理和生命周期配合
- `ExtensionAbility` 虽未在当前项目中实现，但可作为后续扩展桌面卡片、后台服务等能力的方向

## 十一、任务 3：分布式计算器历史记录功能扩展

本次新增“计算器历史记录”功能，目标是让本地设备完成计算后生成历史记录，并通过分布式 KVStore 同步到远端设备。远端设备被拉起后，不仅能够继续接收表达式同步，也能够查看历史记录列表，并点击某条历史记录将表达式和结果载入到当前计算器界面。

### 1. 功能需求

历史记录功能主要包含三点：

- 本地计算完成后记录表达式、结果和记录时间。
- 远端 Ability 被 `Want` 拉起后，主设备主动把已有历史记录同步给远端。
- 远端设备可以打开历史记录面板，点击历史项后恢复对应表达式，并显示历史结果作为预览。

### 2. 页面状态与历史数据结构

代码位置：

```text
entry/src/main/ets/pages/Index.ets
```

页面新增了历史记录状态：

```ts
@State isHistoryVisible: boolean = false
@State historyList: HistoryRecord[] = []
```

其中 `HistoryRecord` 用于描述一条历史记录：

```ts
class HistoryRecord {
  expression: string
  result: string
  time: string
}
```

每条记录保存原表达式、计算结果和生成时间。为了避免同步数据无限增长，当前只保留最近 20 条记录：

```ts
const MAX_HISTORY_COUNT: number = 20
```

### 3. 历史记录生成逻辑

当用户点击 `=`、平方、百分号或开方这类会直接得到最终结果的按钮时，页面会调用：

```ts
addHistory(expression, result)
```

该方法会把最新记录插入到历史列表头部，并去掉相同表达式和相同结果的重复项。随后调用：

```ts
syncHistory()
```

将历史记录序列化为 JSON 字符串并写入分布式 KVStore。

### 4. 分布式历史同步

原项目已经使用 `dataChange` 作为表达式同步 key。本次没有复用该 key，而是新增独立 key：

```ts
const HISTORY_CHANGE: string = 'historyChange'
```

这样可以避免历史记录同步影响原有表达式协同计算逻辑。历史同步仍然复用 `KvStoreModel.put`：

```ts
this.kvStoreModel.put(HISTORY_CHANGE, JSON.stringify(this.historyList))
```

由于 `KvStoreModel.put` 内部已经执行：

```ts
this.kvStore.sync(deviceIds, distributedData.SyncMode.PUSH_PULL, 1000)
```

所以历史记录写入后会通过 PUSH_PULL 模式同步给可用远端设备。

远端设备在 `aboutToAppear` 中额外监听 `historyChange`：

```ts
this.kvStoreModel.setOnMessageReceivedListener(context, HISTORY_CHANGE, (value: string) => {
  this.historyList = this.parseHistory(value)
})
```

收到远端历史 JSON 后，页面会解析并更新 `historyList`，从而刷新历史面板。

### 5. 远端拉起后的主动补发

代码位置：

```text
entry/src/main/ets/common/TitleBarComponent.ets
```

原来远端 Ability 启动成功后只会回调 `DATA_CHANGE`，用于同步当前表达式。本次在启动成功后追加回调：

```ts
this.startAbilityCallBack(DATA_CHANGE)
this.startAbilityCallBack(HISTORY_CHANGE)
```

`Index.ets` 中的 `startAbilityCallBack` 收到 `HISTORY_CHANGE` 后会调用 `syncHistory()`，把主设备当前已有历史立即推送给刚被拉起的远端设备。这样即使历史记录是在远端启动之前产生的，远端启动后也能收到完整历史。

### 6. 历史记录查看与载入

标题栏新增“历史/关闭历史”入口：

```text
entry/src/main/ets/common/TitleBarComponent.ets
```

该入口通过 `@Link isHistoryVisible` 控制主页面历史面板显示状态。历史面板中每条记录展示：

```text
表达式
= 结果
记录时间
```

用户点击历史项时调用：

```ts
loadHistory(item)
```

该方法会恢复：

```ts
this.expression = item.expression
this.result = item.result
```

因此远端设备不仅能够查看主设备同步过来的历史记录，也能够把某条历史记录载入当前计算器，继续编辑或重新计算。

### 7. 与原有分布式能力的关系

本次扩展没有新增新的分布式框架，而是继续复用当前项目已有的 Stage 模型与 KVStore 能力：

- `UIAbility` 仍然负责承载主页面。
- `Want` 仍然负责远端 Ability 拉起。
- `Context` 仍然用于创建 KVStore 和申请分布式数据同步权限。
- `KvStoreModel` 继续负责跨设备数据写入、监听和同步。

区别在于，原项目只同步当前表达式，本次新增了历史记录这种列表型数据。实现时通过独立 key 将“当前表达式状态”和“历史记录状态”拆开，保证两个同步通道互不干扰。

### 8. 本次任务结论

通过历史记录扩展可以看到，分布式 KVStore 不只适合保存单个表达式，也可以保存序列化后的业务列表数据。只要为不同业务状态设计独立 key，并在远端页面中注册对应监听，就可以把本地 UI 状态扩展为跨设备共享状态。

本次功能使计算器从“同步当前输入”扩展为“同步历史上下文”。远端设备被拉起后，能够拿到主设备已有历史，并通过历史面板载入记录，说明 `Want + UIAbility + KVStore` 的组合可以支持更完整的跨设备协同使用场景。
