---
name: Frontend Design
description: High-level UI/UX principles to move beyond generic AI design and create intentional, production-grade interfaces.
---

# Frontend Design Skill

This skill provides a set of design-thinking principles and implementation strategies to create premium, high-fidelity user interfaces.

## 核心设计准则 (Core Principles)

### 1. 设计思考 (Design Thinking)
在编写代码之前，必须先确定一个明确的审美方向。拒绝平庸，追求“有意图”的设计。
- **Esthetics**: 极简主义 (Minimalist)、赛博复古 (Neo-Retro)、杂志感 (Magazine-style)、动态主义 (Dynamic) 等。
- **Consistency**: 确保间距、圆角、背景和阴影在全局范围内保持一致。

### 2. 排版控制 (Typography)
字体是界面的灵魂。
- **Avoid Defaults**: 拒绝 Inter, Arial, Roboto 等默认字体。
- **Personality**: 使用具有强烈性格的字体组合（如 Playfair Display + Lato, Montserrat + Open Sans）。
- **Hierarchy**: 通过字号、字重和颜色的差异建立清晰的信息层级。

### 3. 色彩与主题 (Color & Themes)
色彩不仅仅是装饰，更是情感载体。
- **Intended Palette**: 使用具有凝聚力的 HSL 调色板，而非零散的十六进制颜色。
- **Strong Contrast**: 在深色模式中使用高饱和度强调色，在浅色模式中使用柔和且有高级感的中间色调。

### 4. 动效设计 (Motion Design)
微交互能带来“惊喜感”。
- **CSS Transitions**: 优先使用流畅的 CSS 过渡。
- **Intentionality**: 动画应具有指向性（如按钮点击后的向内缩放），而不是为了动而动。

### 5. 构图与细节 (Composition & Details)
打破无聊的网格布局。
- **Asymmetry**: 适当使用不对称布局增加动感。
- **Visual Depth**: 利用渐变网格 (Gradient Mesh)、颗粒纹理 (Grain Texture) 和多层投影 (Layered Shadows) 增加视觉层次。

## 实施流程 (Workflow)

1. **审美定义**: 明确页面的设计“灵魂”。
2. **基础令牌**: 在 `index.css` 或定义的 CSS 变量中统一排版、颜色、圆角。
3. **关键组件打磨**: 重点修饰那些高频交互的按钮、卡片和导航栏。
4. **动效注入**: 在最后阶段加入画龙点睛的微交互。
