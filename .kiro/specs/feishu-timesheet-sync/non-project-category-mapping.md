# 非项目工时分类与系统计算规则对应说明

## 系统现状分析

### 1. 数据库模型
- **TimeEntry表**中有`category`字段，用于区分工时类型
- 当前支持的值: `Project`（项目工时）、`Non-Project`（非项目工时）

### 2. Excel解析规则
- **项目工时**: 当Excel中"项目名称(新)"或"项目名称(作废)"字段有值时，分类为`Project`
- **非项目工时**: 当Excel中"非项目名称"字段有值时，分类为`Non-Project`

### 3. 人月占比计算规则
在`backend/crud.py`中定义了`_NON_PROJECT_INCLUDE`集合：
```python
_NON_PROJECT_INCLUDE = {"management", "others", "training"}
```

这意味着在计算员工人月占比时，**只有以下非项目工时被计入总工时**：
- `management`（管理工作）
- `others`（其他工作）
- `training`（培训）

**不被计入的非项目工时**：
- `public holiday`（公共假期）
- `timeoff`（休假）

## 需求与系统的对应关系

### 需求30中定义的非项目工时分类

| 分类 | 英文名 | 系统计算规则 | 说明 |
|------|--------|-----------|------|
| Management | management | ✅ 计入人月占比 | 管理工作时间被视为有效工作时间 |
| Others | others | ✅ 计入人月占比 | 其他杂项工作被视为有效工作时间 |
| Training | training | ✅ 计入人月占比 | 培训时间被视为有效工作时间 |
| Public Holiday | public_holiday | ❌ 不计入人月占比 | 公共假期不计入有效工作时间 |
| Timeoff | timeoff | ❌ 不计入人月占比 | 休假不计入有效工作时间 |

## 一致性验证

✅ **系统现状与需求一致**

1. **分类定义一致**: 需求30中定义的5个非项目工时分类与系统中使用的分类完全对应
2. **计算规则一致**: 
   - Management、Others、Training被计入人月占比计算
   - Public Holiday、Timeoff不被计入人月占比计算
3. **数据流一致**:
   - Excel中的"非项目名称"字段 → 系统中的`project_name`字段（当category为Non-Project时）
   - 系统根据`project_name`的值判断是否计入人月占比

## 建议

### 1. 数据验证
在需求30中添加验证规则，确保：
- 非项目工时分类值必须是: management、others、training、public_holiday、timeoff
- 系统应拒绝其他值

### 2. 计算逻辑关联
在工时填报和审批流程中，需要明确说明：
- Management、Others、Training的工时会被计入员工的有效工作时间统计
- Public Holiday、Timeoff的工时不会被计入有效工作时间统计

### 3. 用户提示
在飞书工时填报表单中，应该为用户提示：
- 选择不同的非项目工时分类会影响工时统计结果
- 假期相关的工时（Public Holiday、Timeoff）不计入工作时间统计

## 总结

**需求30中定义的非项目工时分类与系统现有的计算规则完全一致，无需修改。**

系统已经正确地区分了不同类型的非项目工时，并在人月占比计算中应用了相应的规则。
