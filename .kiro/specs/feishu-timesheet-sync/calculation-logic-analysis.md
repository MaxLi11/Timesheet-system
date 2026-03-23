# 网站计算逻辑与飞书新需求的关联分析

## 网站现有计算逻辑

### 1. 人月占比计算（Person-Month Ratio）

**计算规则**:
```
对于每个员工每个月：
  总工时 = 项目工时 + 符合条件的非项目工时
  
  符合条件的非项目工时 = management + others + training
  不符合条件的非项目工时 = public_holiday + timeoff
  
  对于每个项目：
    项目占比 = 该项目工时 / 总工时
```

**代码实现**:
```python
_NON_PROJECT_INCLUDE = {"management", "others", "training"}

# 第一步：统计每位员工每月的总工时
if e.category == "Project":
    employee_month_total[key] += hours
elif e.category == "Non-Project":
    proj = str(e.project_name or "").strip().lower()
    if proj in _NON_PROJECT_INCLUDE:  # 只计入符合条件的非项目工时
        employee_month_total[key] += hours

# 第二步：计算占比
ratio = proj_hours / total if total > 0 else 0
```

### 2. 数据过滤规则

**关键过滤条件**:
- 仅统计 `current_node = "Close"` 的记录（已批准的工时）
- 仅统计 `category = "Project"` 的项目工时
- 非项目工时需要满足分类条件

### 3. 月份归属规则

**月份确定逻辑**:
1. 优先查询工作周划分表（WorkWeek表）
2. 如果找到对应的周，使用该周的 `work_month`
3. 如果未找到，使用工时的开始日期的自然月

## 飞书新需求对计算逻辑的影响

### 需求29: 项目和项目经理配置

**对计算逻辑的影响**:
- ✅ **无直接影响** - 项目配置只影响审批流程，不影响工时计算
- ⚠️ **间接影响** - 需要验证项目名称的有效性
  - 导出时应验证项目名称是否在PM配置中
  - 如果项目名称无效，应标记为异常

**建议的改进**:
```python
# 在计算前验证项目名称
valid_projects = get_valid_projects_from_pm_config()
for entry in entries:
    if entry.project_name not in valid_projects:
        log_warning(f"Invalid project: {entry.project_name}")
```

### 需求30: 非项目工时分类

**对计算逻辑的影响**:
- ✅ **完全一致** - 现有计算逻辑已经正确实现了分类规则
- 当前代码中的 `_NON_PROJECT_INCLUDE = {"management", "others", "training"}` 完全对应需求30的定义
- Public Holiday 和 Timeoff 不计入总工时，与需求一致

**验证**:
```
需求30定义的分类:
- Management → 计入人月占比 ✓
- Others → 计入人月占比 ✓
- Training → 计入人月占比 ✓
- Public Holiday → 不计入人月占比 ✓
- Timeoff → 不计入人月占比 ✓

现有代码实现:
_NON_PROJECT_INCLUDE = {"management", "others", "training"}
→ 完全匹配 ✓
```

### 需求31: 标准工时配置

**对计算逻辑的影响**:
- ⚠️ **需要新增计算** - 现有计算逻辑中没有标准工时的概念
- 需要在计算中引入标准工时，用于：
  1. 工时差异分析（实际工时 - 标准工时）
  2. 工时异常预警
  3. 工时完成度统计

**建议的改进**:
```python
def get_person_month_ratio_with_standard_hours(db: Session):
    """
    在现有人月占比计算基础上，添加标准工时信息
    """
    # 获取标准工时配置
    standard_hours = get_standard_hours_config(db)
    
    # 现有计算逻辑...
    result = get_person_month_ratio(db)
    
    # 添加标准工时和差异
    for row in result["rows"]:
        for month in result["months"]:
            actual_hours = row["months"].get(month, 0)
            standard = standard_hours.get(month, 0)
            row["standard_hours"] = standard
            row["hours_delta"] = actual_hours - standard
            row["completion_rate"] = actual_hours / standard if standard > 0 else 0
    
    return result
```

## 计算逻辑一致性检查

### 1. 非项目工时分类一致性 ✓

| 分类 | 需求30 | 现有代码 | 一致性 |
|------|--------|---------|--------|
| Management | 计入 | 在_NON_PROJECT_INCLUDE中 | ✓ |
| Others | 计入 | 在_NON_PROJECT_INCLUDE中 | ✓ |
| Training | 计入 | 在_NON_PROJECT_INCLUDE中 | ✓ |
| Public Holiday | 不计入 | 不在_NON_PROJECT_INCLUDE中 | ✓ |
| Timeoff | 不计入 | 不在_NON_PROJECT_INCLUDE中 | ✓ |

### 2. 审批状态一致性 ✓

| 条件 | 需求4 | 现有代码 | 一致性 |
|------|--------|---------|--------|
| 只统计已批准工时 | current_node = "Close" | 过滤条件中有 | ✓ |
| 排除待审批工时 | 不包含 | 过滤条件中有 | ✓ |

### 3. 月份归属一致性 ✓

| 规则 | 需求31 | 现有代码 | 一致性 |
|------|--------|---------|--------|
| 支持工作周划分 | 需要 | 优先查WorkWeek表 | ✓ |
| 支持自然月 | 需要 | 备选方案 | ✓ |

## 需要改进的地方

### 1. 标准工时集成 ⚠️

**当前状态**: 计算逻辑中没有标准工时
**需要改进**: 
- 在人月占比计算中添加标准工时信息
- 计算工时差异和完成度
- 支持按标准工时进行异常预警

### 2. 项目名称验证 ⚠️

**当前状态**: 没有验证项目名称的有效性
**需要改进**:
- 在计算前验证项目名称是否在PM配置中
- 对无效项目名称进行标记和告警
- 支持项目名称的映射和转换

### 3. 非项目工时分类验证 ✓

**当前状态**: 已正确实现
**无需改进**: 现有代码已经正确处理了所有分类

### 4. 审批流程追踪 ⚠️

**当前状态**: 只检查最终状态（current_node = "Close"）
**需要改进**:
- 记录审批链路（部门负责人 → PL → PM）
- 支持按审批人进行统计
- 支持审批流程的可视化

## 建议的改进方案

### 1. 增强人月占比计算
```python
def get_person_month_ratio_enhanced(db: Session):
    """
    增强的人月占比计算，包含标准工时和项目验证
    """
    # 验证项目名称
    valid_projects = validate_project_names(db)
    
    # 获取标准工时
    standard_hours_config = get_standard_hours_config(db)
    
    # 现有计算逻辑
    result = get_person_month_ratio(db)
    
    # 添加标准工时和差异
    for row in result["rows"]:
        # 验证项目
        if row["project_name"] not in valid_projects:
            row["project_status"] = "invalid"
        
        # 添加标准工时
        for month in result["months"]:
            standard = standard_hours_config.get(month, 0)
            row["standard_hours"] = standard
    
    return result
```

### 2. 添加审批流程追踪
```python
def get_approval_chain_tracking(db: Session):
    """
    追踪工时的审批链路
    """
    entries = db.query(database.TimeEntry).all()
    
    for entry in entries:
        approval_chain = {
            "timesheet_id": entry.id,
            "department_approver": entry.department_approver,
            "pl_approver": entry.pl_approver,
            "pm_approver": entry.pm_approver,
            "approval_status": entry.current_node,
        }
```

### 3. 添加项目名称验证
```python
def validate_project_names(db: Session):
    """
    验证所有项目名称是否在PM配置中
    """
    configured_projects = get_pm_configured_projects(db)
    entries = db.query(database.TimeEntry).all()
    
    for entry in entries:
        if entry.category == "Project":
            if entry.project_name not in configured_projects:
                log_warning(f"Invalid project: {entry.project_name}")
```

## 总结

### 计算逻辑与飞书新需求的关联

1. **需求29（项目配置）**
   - 现有计算逻辑: 无直接影响
   - 建议改进: 添加项目名称验证

2. **需求30（非项目工时分类）**
   - 现有计算逻辑: ✓ 完全一致
   - 无需改进

3. **需求31（标准工时配置）**
   - 现有计算逻辑: 需要新增
   - 建议改进: 添加标准工时和差异计算

### 一致性评估

- **非项目工时分类**: ✓ 完全一致
- **审批状态过滤**: ✓ 完全一致
- **月份归属规则**: ✓ 完全一致
- **标准工时集成**: ⚠️ 需要改进
- **项目名称验证**: ⚠️ 需要改进
- **审批流程追踪**: ⚠️ 需要改进

### 建议的后续行动

1. 在需求文档中添加计算逻辑的详细说明
2. 在设计阶段明确标准工时的集成方式
3. 在实现阶段添加项目名称验证和审批流程追踪
